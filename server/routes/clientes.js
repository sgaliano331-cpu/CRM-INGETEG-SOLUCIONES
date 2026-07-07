const express = require('express');
const router = express.Router();
const { getDb, getClient } = require('../db');
const { authMiddleware, soloCoordinador } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Multer para importación CSV/TXT de clientes ───────────────────────────
const uploadDir = path.join(__dirname, '../uploads/importaciones');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `import_${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage });

// ─── GET /api/clientes/siguiente (CON FILTRO DE DIAGNÓSTICO EN PANTALLA) ───
router.get('/siguiente', authMiddleware, (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const esCoord = req.user.rol === 'COORDINADOR';

  let query = '';
  let params = [];

  // Estructura limpia con LEFT JOIN para asegurar consistencia de propiedades en el Frontend
  if (esCoord) {
    query = `
      SELECT c.*, u.nombre AS asesora_nombre
      FROM clientes c
      LEFT JOIN usuarios u ON c.asignado_a = u.id
      WHERE c.llamado = 0
      ORDER BY c.prioridad DESC, c.asignado_a, c.posicion_cola ASC
      LIMIT 1
    `;
  } else {
    query = `
      SELECT c.*, u.nombre AS asesora_nombre
      FROM clientes c
      LEFT JOIN usuarios u ON c.asignado_a = u.id
      WHERE c.asignado_a = ? AND c.llamado = 0
      ORDER BY c.prioridad DESC, c.posicion_cola ASC
      LIMIT 1
    `;
    params.push(userId);
  }

  db.get(query, params, (err, cliente) => {
    if (err) {
      console.error('Error crítico en /clientes/siguiente:', err.message);
      // Enviamos el mensaje real de SQLite directo al JSON para que lo leas en el banner gris
      return res.status(500).json({ error: `Falla en DB: ${err.message}` });
    }
    if (!cliente) return res.json({ cliente: null, mensaje: 'No hay clientes en cola' });
    res.json({ cliente });
  });
});

// ─── GET /api/clientes/lista (SOLO COORDINADOR) ───────────────────────────
router.get('/lista', authMiddleware, soloCoordinador, (req, res) => {
  const db = getDb();
  const { asesora_id, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT c.*, u.nombre AS asesora_nombre
    FROM clientes c LEFT JOIN usuarios u ON c.asignado_a = u.id
  `;
  const params = [];
  if (asesora_id) {
    query += ' WHERE c.asignado_a = ?';
    params.push(asesora_id);
  }
  query += ' ORDER BY c.asignado_a, c.posicion_cola ASC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);

  db.all(query, params, (err, clientes) => {
    if (err) {
      console.error('Error en /lista (clientes):', err.message);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }

    const countQuery = `SELECT COUNT(*) as cnt FROM clientes${asesora_id ? ' WHERE asignado_a = ?' : ''}`;
    const countParams = asesora_id ? [asesora_id] : [];

    db.get(countQuery, countParams, (errCount, total) => {
      if (errCount) {
        console.error('Error en /lista (count):', errCount.message);
        return res.status(500).json({ error: 'Error en la base de datos' });
      }
      res.json({ clientes: clientes || [], total: total ? total.cnt : 0 });
    });
  });
});

// ─── PUT /api/clientes/:id ────────────────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const clienteId = req.params.id;
  const userId = req.user.id;
  const esCoord = req.user.rol === 'COORDINADOR';

  db.get('SELECT * FROM clientes WHERE id = ?', [clienteId], (err, cliente) => {
    if (err || !cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    if (!esCoord && cliente.asignado_a !== userId) {
      return res.status(403).json({ error: 'No tiene permiso para editar este cliente' });
    }

    const { nombre, telefono, direccion, barrio, ciudad } = req.body;
    db.run(`
      UPDATE clientes SET nombre=?, telefono=?, direccion=?, barrio=?, ciudad=?,
      actualizado_en=NOW() WHERE id=?
    `, [nombre, telefono, direccion, barrio, ciudad, clienteId], function(errUpdate) {
      if (errUpdate) return res.status(500).json({ error: 'Error al actualizar' });
      res.json({ ok: true });
    });
  });
});

// ─── POST /api/clientes/nuevo ─────────────────────────────────────────────
router.post('/nuevo', authMiddleware, (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const esCoord = req.user.rol === 'COORDINADOR';
  const { nombre, telefono, direccion, barrio, ciudad, asignado_a, prioridad } = req.body;

  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  const targetUserId = (esCoord && asignado_a) ? asignado_a : userId;
  const esPrioridad = prioridad ? 1 : 0;

  db.get('SELECT MAX(posicion_cola) as mx FROM clientes WHERE asignado_a = ?', [targetUserId], (err, maxPos) => {
    const posicion = ((maxPos ? maxPos.mx : 0) || 0) + 1;

    db.run(`
      INSERT INTO clientes (nombre, telefono, direccion, barrio, ciudad, asignado_a, posicion_cola, prioridad, llamado, creado_en, actualizado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())
    `, [nombre || '', telefono || '', direccion || '', barrio || '', ciudad || 'Medellín', targetUserId, posicion, esPrioridad], function(errInsert) {
      if (errInsert) return res.status(500).json({ error: 'Error al guardar el cliente' });
      res.status(201).json({ id: this.lastID, posicion });
    });
  });
});

// ─── GET /api/clientes/asesoras (SOLO COORDINADOR) ────────────────────────
router.get('/asesoras/lista', authMiddleware, soloCoordinador, (req, res) => {
  const db = getDb();
  db.all("SELECT id, nombre, username FROM usuarios WHERE rol = 'ASESORA' AND activo = 1", [], (err, asesoras) => {
    if (err) return res.status(500).json({ error: 'Error al consultar asesoras' });
    res.json({ asesoras: asesoras || [] });
  });
});

// ─── POST /api/clientes/importar (SOLO COORDINADOR) ──────────────────────
router.post('/importar', authMiddleware, soloCoordinador, async (req, res) => {
  const { clientes: nuevosClientes, asesora_id, prioridad } = req.body;
  const esPrioridad = prioridad ? 1 : 0;

  if (!Array.isArray(nuevosClientes) || nuevosClientes.length === 0) {
    return res.status(400).json({ error: 'Se requiere un arreglo de clientes' });
  }

  let client;
  try {
    client = await getClient();
    await client.query('BEGIN');

    if (asesora_id) {
      const maxRow = await client.query('SELECT MAX(posicion_cola) as mx FROM clientes WHERE asignado_a = $1', [asesora_id]);
      let pos = (maxRow.rows[0]?.mx || 0);

      for (const c of nuevosClientes) {
        pos++;
        await client.query(
          `INSERT INTO clientes (nombre, telefono, direccion, barrio, ciudad, asignado_a, posicion_cola, prioridad, llamado, creado_en, actualizado_en)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, NOW(), NOW())`,
          [c.nombre || '', c.telefono || '', c.direccion || '', c.barrio || '', c.ciudad || 'Medellín', asesora_id, pos, esPrioridad]
        );
      }
    } else {
      const asesorasRes = await client.query("SELECT id FROM usuarios WHERE rol = 'ASESORA' AND activo = 1 ORDER BY id");
      const asesoras = asesorasRes.rows;
      if (!asesoras || asesoras.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'No hay asesoras activas para asignar' });
      }

      const filasMaxRes = await client.query('SELECT asignado_a, MAX(posicion_cola) as mx FROM clientes GROUP BY asignado_a');
      const maxPosPorAsesora = {};
      asesoras.forEach(a => maxPosPorAsesora[a.id] = 0);
      if (filasMaxRes.rows) {
        filasMaxRes.rows.forEach(f => { maxPosPorAsesora[f.asignado_a] = f.mx || 0; });
      }

      let asesoraIdx = 0;
      for (const c of nuevosClientes) {
        const asesoraId = asesoras[asesoraIdx % asesoras.length].id;
        maxPosPorAsesora[asesoraId]++;
        await client.query(
          `INSERT INTO clientes (nombre, telefono, direccion, barrio, ciudad, asignado_a, posicion_cola, prioridad, llamado, creado_en, actualizado_en)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, NOW(), NOW())`,
          [c.nombre || '', c.telefono || '', c.direccion || '', c.barrio || '', c.ciudad || 'Medellín', asesoraId, maxPosPorAsesora[asesoraId], esPrioridad]
        );
        asesoraIdx++;
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true, importados: nuevosClientes.length });
  } catch (err) {
    if (client) try { await client.query('ROLLBACK'); } catch (e) {}
    console.error('Error en importación:', err.message);
    res.status(500).json({ error: 'Error en la transacción de importación' });
  } finally {
    if (client) client.release();
  }
});

// ─── GET /api/clientes/fidelizacion/:meses (COORD + ASESORA propios) ──────
router.get('/fidelizacion/:meses', authMiddleware, (req, res) => {
  const db = getDb();
  const meses = parseInt(req.params.meses);
  if (![3, 12].includes(meses)) return res.status(400).json({ error: 'Solo 3 o 12 meses' });

  const userId = req.user.id;
  const esCoord = req.user.rol === 'COORDINADOR';

  const query = `
    SELECT DISTINCT c.*, u.nombre AS asesora_nombre,
           a.fecha_agendamiento, a.equipos, a.tipo_servicio
    FROM agendamientos a
    JOIN clientes c ON a.cliente_id = c.id
    LEFT JOIN usuarios u ON c.asignado_a = u.id
    WHERE a.estado_servicio = 'Cumplido'
      AND a.fecha_agendamiento::date BETWEEN (NOW() - INTERVAL '${meses} months')::date - 7 AND (NOW() - INTERVAL '${meses} months')::date + 7
      ${!esCoord ? 'AND c.asignado_a = ?' : ''}
    ORDER BY a.fecha_agendamiento ASC
  `;

  const params = esCoord ? [] : [userId];

  db.all(query, params, (err, clientes) => {
    if (err) {
      console.error('Error en /fidelizacion:', err.message);
      return res.status(500).json({ error: 'Error al consultar fidelización' });
    }
    res.json({ clientes: clientes || [] });
  });
});

module.exports = router;