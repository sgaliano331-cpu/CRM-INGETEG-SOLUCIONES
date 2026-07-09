const express = require('express');
const router = express.Router();
const { getDb, getClient } = require('../db');
const { authMiddleware, gestorOCoordinador } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Multer para comprobantes de pago ─────────────────────────────────────
const comprobantesDir = path.join(__dirname, '../uploads/comprobantes');
if (!fs.existsSync(comprobantesDir)) fs.mkdirSync(comprobantesDir, { recursive: true });

const storageComp = multer.diskStorage({
  destination: (req, file, cb) => cb(null, comprobantesDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `comprobante_${Date.now()}${ext}`);
  },
});
const uploadComp = multer({
  storage: storageComp,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ─── POST /api/llamadas/iniciar ───────────────────────────────────────────
router.post('/iniciar', authMiddleware, (req, res) => {
  const db = getDb();
  const { cliente_id } = req.body;
  if (!cliente_id) return res.status(400).json({ error: 'cliente_id requerido' });

  db.run(`
    INSERT INTO historial_llamadas (cliente_id, usuario_id, inicio_llamada, creado_en)
    VALUES (?, ?, NOW(), NOW())
  `, [cliente_id, req.user.id], function(err) {
    if (err) {
      console.error('Error al iniciar llamada:', err.message);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }
    res.json({ historial_id: this.lastID });
  });
});

// ─── POST /api/llamadas/guardar ───────────────────────────────────────────
router.post('/guardar', authMiddleware, async (req, res) => {
  const {
    historial_id,
    cliente_id,
    observaciones,
    acepto_servicio,
    inicio_llamada,
    equipos,
    tipo_servicio,
    fecha_agendamiento,
    costo_cop,
  } = req.body;

  if (!historial_id || !observaciones) {
    return res.status(400).json({ error: 'historial_id y observaciones son requeridos' });
  }

  let client;
  try {
    client = await getClient();
    await client.query('BEGIN');

    const inicio = new Date(inicio_llamada);
    const ahora = new Date();
    const duracionSeg = Math.round((ahora - inicio) / 1000);

    await client.query(
      `UPDATE historial_llamadas SET fin_llamada = NOW(), duracion_segundos = $1, observaciones = $2, acepto_servicio = $3 WHERE id = $4`,
      [duracionSeg, observaciones, acepto_servicio ? 1 : 0, historial_id]
    );

    await client.query(
      `UPDATE clientes SET llamado = 1, actualizado_en = NOW() WHERE id = $1`,
      [cliente_id]
    );

    let agendamientoId = null;
    if (acepto_servicio && equipos && tipo_servicio && fecha_agendamiento) {
      const agResult = await client.query(
        `INSERT INTO agendamientos (historial_id, cliente_id, usuario_id, equipos, tipo_servicio, fecha_agendamiento, costo_cop, estado_servicio, creado_en, actualizado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Agendado', NOW(), NOW()) RETURNING id`,
        [historial_id, cliente_id, req.user.id, equipos, tipo_servicio, fecha_agendamiento, costo_cop || 0]
      );
      agendamientoId = agResult.rows[0].id;
    }

    await client.query('COMMIT');
    res.json({ ok: true, duracionSeg, agendamientoId });
  } catch (err) {
    if (client) try { await client.query('ROLLBACK'); } catch (e) {}
    console.error('Error en guardar llamada:', err.message);
    res.status(500).json({ error: 'Error al guardar la llamada' });
  } finally {
    if (client) client.release();
  }
});

// ─── GET /api/llamadas/mis-registros ─────────────────────────────────────
router.get('/mis-registros', authMiddleware, (req, res) => {
  const db = getDb();
  db.all(`
    SELECT hl.*, c.nombre AS cliente_nombre, c.telefono
    FROM historial_llamadas hl
    JOIN clientes c ON hl.cliente_id = c.id
    WHERE hl.usuario_id = ?
    ORDER BY hl.creado_en DESC
    LIMIT 100
  `, [req.user.id], (err, registros) => {
    if (err) return res.status(500).json({ error: 'Error al consultar registros' });
    res.json({ registros: registros || [] });
  });
});

// ─── GET /api/llamadas/mis-clientes ──────────────────────────────────────
router.get('/mis-clientes', authMiddleware, (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  const query = `
    SELECT
      c.id AS cliente_id, c.nombre, c.telefono, c.direccion, c.barrio, c.ciudad,
      hl.id AS historial_id, hl.observaciones AS obs_marcacion,
      hl.inicio_llamada, hl.fin_llamada, hl.acepto_servicio,
      a.id AS agendamiento_id, a.equipos, a.tipo_servicio,
      a.fecha_agendamiento, a.estado_servicio, a.metodo_pago,
      a.costo_cop, a.observaciones_tecnica AS obs_tecnica,
      a.comprobante_pago_url,
      co.valor_cotizacion, co.observacion_gestor, co.observacion_asesora, co.estado AS estado_cotizacion
    FROM historial_llamadas hl
    JOIN clientes c ON hl.cliente_id = c.id
    LEFT JOIN agendamientos a ON a.historial_id = hl.id
    LEFT JOIN cotizaciones co ON co.agendamiento_id = a.id
    WHERE hl.usuario_id = ?
      AND hl.fin_llamada IS NOT NULL
    ORDER BY c.nombre ASC, hl.inicio_llamada DESC
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error('Error en /mis-clientes:', err.message);
      return res.status(500).json({ error: 'Error al consultar clientes' });
    }

    const mapaClientes = {};
    for (const row of (rows || [])) {
      if (!mapaClientes[row.cliente_id]) {
        mapaClientes[row.cliente_id] = {
          cliente_id: row.cliente_id,
          nombre: row.nombre,
          telefono: row.telefono,
          direccion: row.direccion,
          barrio: row.barrio,
          ciudad: row.ciudad,
          servicios: [],
        };
      }
      mapaClientes[row.cliente_id].servicios.push({
        historial_id: row.historial_id,
        obs_marcacion: row.obs_marcacion,
        inicio_llamada: row.inicio_llamada,
        fin_llamada: row.fin_llamada,
        acepto_servicio: row.acepto_servicio,
        agendamiento_id: row.agendamiento_id,
        equipos: row.equipos,
        tipo_servicio: row.tipo_servicio,
        fecha_agendamiento: row.fecha_agendamiento,
        estado_servicio: row.estado_servicio,
        metodo_pago: row.metodo_pago,
        costo_cop: row.costo_cop,
        obs_tecnica: row.obs_tecnica,
        comprobante_pago_url: row.comprobante_pago_url,
        valor_cotizacion: row.valor_cotizacion,
        observacion_gestor: row.observacion_gestor,
        observacion_asesora: row.observacion_asesora,
        estado_cotizacion: row.estado_cotizacion,
      });
    }

    const clientes = Object.values(mapaClientes);
    clientes.sort((a, b) => {
      const fa = new Date(a.servicios[0]?.inicio_llamada || 0).getTime();
      const fb = new Date(b.servicios[0]?.inicio_llamada || 0).getTime();
      return fb - fa;
    });

    res.json({ clientes });
  });
});

// ─── POST /api/llamadas/nuevo-servicio ──────────────────────────────────────
router.post('/nuevo-servicio', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { cliente_id, equipos, tipo_servicio, fecha_agendamiento, costo_cop, observaciones } = req.body;

  if (!cliente_id || !equipos || !tipo_servicio || !fecha_agendamiento) {
    return res.status(400).json({ error: 'Cliente, equipos, tipo de servicio y fecha son requeridos' });
  }

  let client;
  try {
    client = await getClient();
    await client.query('BEGIN');

    const hlResult = await client.query(
      `INSERT INTO historial_llamadas (cliente_id, usuario_id, inicio_llamada, fin_llamada, duracion_segundos, observaciones, acepto_servicio)
       VALUES ($1, $2, NOW(), NOW(), 0, $3, 1) RETURNING id`,
      [cliente_id, userId, observaciones || 'Nuevo servicio programado desde Mis Clientes']
    );
    const histId = hlResult.rows[0].id;

    const agResult = await client.query(
      `INSERT INTO agendamientos (historial_id, cliente_id, usuario_id, equipos, tipo_servicio, fecha_agendamiento, costo_cop, estado_servicio, creado_en, actualizado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Agendado', NOW(), NOW()) RETURNING id`,
      [histId, cliente_id, userId, equipos, tipo_servicio, fecha_agendamiento, parseFloat(costo_cop) || 0]
    );

    await client.query('COMMIT');
    res.json({ ok: true, agendamiento_id: agResult.rows[0].id });
  } catch (err) {
    if (client) try { await client.query('ROLLBACK'); } catch (e) {}
    console.error('Error en nuevo-servicio:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
});

// ─── PUT /api/llamadas/actualizar-servicio/:id ───────────────────────────────
router.put('/actualizar-servicio/:id', authMiddleware, gestorOCoordinador, uploadComp.single('comprobante'), (req, res) => {
  const db = getDb();
  const agId = req.params.id;
  const { estado_servicio, metodo_pago, observaciones_tecnica, costo_cop, valor_cotizacion, id_servicio, tecnico, fecha_atencion } = req.body;

  if (!estado_servicio || !metodo_pago) {
    return res.status(400).json({ error: 'Estado y método de pago son requeridos' });
  }

  const comprobante_url = req.file ? `/uploads/comprobantes/${req.file.filename}` : null;

  if (metodo_pago === 'Transferencia' && !req.file) {
    db.get('SELECT comprobante_pago_url FROM agendamientos WHERE id = ?', [agId], (errCheck, row) => {
      if (!row?.comprobante_pago_url) {
        return res.status(400).json({ error: 'Debes subir el comprobante de transferencia' });
      }
      guardar(null);
    });
  } else {
    guardar(comprobante_url);
  }

  function guardar(urlComprobante) {
    const esCoord = req.user.rol === 'COORDINADOR';

    // Verificar estado actual antes de actualizar
    db.get('SELECT estado_servicio FROM agendamientos WHERE id = ?', [agId], (errCurr, current) => {
      if (errCurr || !current) {
        return res.status(404).json({ error: 'Agendamiento no encontrado' });
      }

      if (current.estado_servicio === 'Cumplido' && !esCoord) {
        return res.status(403).json({ error: 'Solo el coordinador puede modificar un servicio ya cumplido' });
      }

      if (current.estado_servicio === 'Cumplido' && estado_servicio === 'Cumplido') {
        return res.status(400).json({ error: 'Este servicio ya fue marcado como cumplido' });
      }

      const setCosto = (esCoord || req.user.rol === 'GESTOR') && costo_cop !== undefined && costo_cop !== '';
      const esGestorOCoord = req.user.rol === 'GESTOR' || esCoord;
      const setIdServicio = esGestorOCoord && id_servicio !== undefined;
      const setTecnico = esGestorOCoord && tecnico !== undefined;
      const setFechaAtencion = esGestorOCoord && fecha_atencion !== undefined;

      const sql = `
        UPDATE agendamientos SET
          estado_servicio = ?,
          metodo_pago = ?,
          observaciones_tecnica = ?,
          comprobante_pago_url = COALESCE(?, comprobante_pago_url)
          ${setCosto ? ', costo_cop = ?' : ''}
          ${setIdServicio ? ', id_servicio = ?' : ''}
          ${setTecnico ? ', tecnico = ?' : ''}
          ${setFechaAtencion ? ', fecha_atencion = ?' : ''}
          , actualizado_en = NOW()
        WHERE id = ?
      `;
      const params = [estado_servicio, metodo_pago, observaciones_tecnica || null, urlComprobante];
      if (setCosto) params.push(parseFloat(costo_cop) || 0);
      if (setIdServicio) params.push(id_servicio.trim() || null);
      if (setTecnico) params.push(tecnico.trim() || null);
      if (setFechaAtencion) params.push(fecha_atencion.trim() || null);
      params.push(agId);

      db.run(sql, params, function(err) {
        if (err) {
          console.error('Error actualizando servicio:', err.message);
          return res.status(500).json({ error: 'Error al actualizar el servicio' });
        }

        res.json({ ok: true, comprobante_url: urlComprobante });
      });
    });
  }
});

// ─── PUT /api/llamadas/subir-comprobante/:id ─────────────────────────────
router.put('/subir-comprobante/:id', authMiddleware, uploadComp.single('comprobante'), (req, res) => {
  const db = getDb();
  const agId = req.params.id;

  if (!req.file) {
    return res.status(400).json({ error: 'Debes subir un archivo' });
  }

  const comprobante_url = `/uploads/comprobantes/${req.file.filename}`;

  db.run(
    `UPDATE agendamientos SET comprobante_pago_url = ?, metodo_pago = 'Transferencia', actualizado_en = NOW() WHERE id = ?`,
    [comprobante_url, agId],
    function (err) {
      if (err) {
        console.error('Error subiendo comprobante:', err.message);
        return res.status(500).json({ error: 'Error al subir comprobante' });
      }
      res.json({ ok: true, comprobante_url });
    }
  );
});

// ─── GET /api/llamadas/pendientes-cobro ───────────────────────────────────
router.get('/pendientes-cobro', authMiddleware, (req, res) => {
  const db = getDb();
  const { asesora_id } = req.query;
  const esCoord = req.user.rol === 'COORDINADOR';

  let query = `
    SELECT a.*, c.nombre AS cliente_nombre, c.telefono, c.direccion, c.barrio, c.ciudad,
           u.nombre AS asesora_nombre,
           hl.observaciones AS obs_marcacion, a.observaciones_tecnica AS obs_tecnica
    FROM agendamientos a
    JOIN clientes c ON a.cliente_id = c.id
    JOIN usuarios u ON a.usuario_id = u.id
    JOIN historial_llamadas hl ON a.historial_id = hl.id
    WHERE a.metodo_pago = 'Pendiente por cobro'
  `;
  const params = [];

  if (esCoord && asesora_id) {
    query += ' AND a.usuario_id = ?';
    params.push(asesora_id);
  } else if (!esCoord) {
    query += ' AND a.usuario_id = ?';
    params.push(req.user.id);
  }
  query += ' ORDER BY a.fecha_agendamiento DESC';

  db.all(query, params, (err, pendientes) => {
    if (err) return res.status(500).json({ error: 'Error al consultar pendientes de cobro' });
    res.json({ pendientes: pendientes || [] });
  });
});

// ─── GET /api/llamadas/pendientes-repuesto ────────────────────────────────
router.get('/pendientes-repuesto', authMiddleware, gestorOCoordinador, (req, res) => {
  const db = getDb();
  const esGlobal = req.user.rol === 'COORDINADOR' || req.user.rol === 'GESTOR';

  let query = `
    SELECT a.*, c.nombre AS cliente_nombre, c.telefono, c.ciudad,
           hl.observaciones AS obs_marcacion, a.observaciones_tecnica AS obs_tecnica,
           u.nombre AS asesora_nombre
    FROM agendamientos a
    JOIN clientes c ON a.cliente_id = c.id
    JOIN historial_llamadas hl ON a.historial_id = hl.id
    JOIN usuarios u ON a.usuario_id = u.id
    WHERE a.estado_servicio = 'Pendiente por repuesto'
    AND NOT EXISTS (SELECT 1 FROM cotizaciones co WHERE co.agendamiento_id = a.id)
    ${!esGlobal ? 'AND a.usuario_id = ?' : ''}
    ORDER BY a.fecha_agendamiento DESC
  `;

  const params = esGlobal ? [] : [req.user.id];

  db.all(query, params, (err, pendientes) => {
    if (err) return res.status(500).json({ error: 'Error al consultar pendientes de repuesto' });
    res.json({ pendientes: pendientes || [] });
  });
});

// ─── PUT /api/llamadas/enviar-cotizacion/:id ──────────────────────────────
router.put('/enviar-cotizacion/:id', authMiddleware, gestorOCoordinador, (req, res) => {
  const db = getDb();
  const agId = req.params.id;
  const { observacion_repuesto, valor_cotizacion } = req.body;

  if (!valor_cotizacion || parseFloat(valor_cotizacion) <= 0) {
    return res.status(400).json({ error: 'El valor de cotización es obligatorio' });
  }
  if (!observacion_repuesto || !observacion_repuesto.trim()) {
    return res.status(400).json({ error: 'La observación de repuesto es obligatoria' });
  }

  db.get('SELECT id, cliente_id, usuario_id, estado_servicio FROM agendamientos WHERE id = ?', [agId], (err, ag) => {
    if (err || !ag) return res.status(404).json({ error: 'Agendamiento no encontrado' });
    if (ag.estado_servicio !== 'Pendiente por repuesto') {
      return res.status(400).json({ error: 'Este servicio no está pendiente por repuesto' });
    }

    db.get('SELECT id FROM cotizaciones WHERE agendamiento_id = ? AND estado IN (\'pendiente\',\'piensa\')', [agId], (errC, existing) => {
      if (existing) return res.status(400).json({ error: 'Ya existe una cotización activa para este servicio' });

      db.run(
        `INSERT INTO cotizaciones (agendamiento_id, cliente_id, asesora_id, gestor_id, valor_cotizacion, observacion_gestor)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [agId, ag.cliente_id, ag.usuario_id, req.user.id, parseFloat(valor_cotizacion), observacion_repuesto.trim()],
        function (err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ ok: true, cotizacion_id: this.lastID });
        }
      );
    });
  });
});

// ─── GET /api/llamadas/buscar-agendamiento ────────────────────────────────
router.get('/buscar-agendamiento', authMiddleware, (req, res) => {
  const db = getDb();
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parámetro q requerido' });

  const esCoord = req.user.rol === 'COORDINADOR';
  const like = `%${q}%`;

  const query = `
    SELECT a.*, c.nombre AS cliente_nombre, c.telefono, c.ciudad,
           u.nombre AS asesora_nombre
    FROM agendamientos a
    JOIN clientes c ON a.cliente_id = c.id
    JOIN usuarios u ON a.usuario_id = u.id
    WHERE (c.nombre LIKE ? OR c.telefono LIKE ?)
      ${!esCoord ? 'AND a.usuario_id = ?' : ''}
    ORDER BY a.creado_en DESC
    LIMIT 20
  `;

  const params = esCoord ? [like, like] : [like, like, req.user.id];

  db.all(query, params, (err, resultados) => {
    if (err) return res.status(500).json({ error: 'Error al buscar agendamientos' });
    res.json({ resultados: resultados || [] });
  });
});

// ─── GET /api/llamadas/clientes-llamados ─────────────────────────────────
router.get('/clientes-llamados', authMiddleware, gestorOCoordinador, (req, res) => {
  const db = getDb();
  const esCoord = req.user.rol === 'COORDINADOR';
  const { asesora_id, solo_agendados, buscar, estado } = req.query;

  let query = `
    SELECT c.id AS cliente_id, c.nombre, c.telefono, c.direccion, c.barrio, c.ciudad,
           u.nombre AS asesora_nombre, c.asignado_a,
           hl.id AS llamada_id, hl.inicio_llamada, hl.fin_llamada, hl.duracion_segundos,
           hl.observaciones, hl.acepto_servicio,
           a.id AS agendamiento_id, a.equipos, a.tipo_servicio, a.fecha_agendamiento,
           a.costo_cop, a.estado_servicio, a.metodo_pago, a.comprobante_pago_url,
           a.observaciones_tecnica, a.id_servicio, a.tecnico, a.fecha_atencion
    FROM clientes c
    JOIN usuarios u ON c.asignado_a = u.id
    JOIN historial_llamadas hl ON hl.cliente_id = c.id AND hl.fin_llamada IS NOT NULL
    LEFT JOIN agendamientos a ON a.historial_id = hl.id
    WHERE c.llamado = 1
      AND (
        a.id IS NOT NULL
        OR hl.id = (
          SELECT MAX(hl2.id) FROM historial_llamadas hl2
          WHERE hl2.cliente_id = c.id AND hl2.fin_llamada IS NOT NULL
        )
      )
  `;

  const params = [];

  const esGlobal = esCoord || req.user.rol === 'GESTOR';

  if (esGlobal && asesora_id) {
    query += ' AND c.asignado_a = ?';
    params.push(asesora_id);
  } else if (!esGlobal) {
    query += ' AND c.asignado_a = ?';
    params.push(req.user.id);
  }

  if (buscar) {
    query += ' AND (c.nombre LIKE ? OR c.telefono LIKE ?)';
    const like = `%${buscar}%`;
    params.push(like, like);
  }
  if (estado === 'Sin agendar') {
    query += ' AND a.id IS NULL';
  } else if (estado) {
    query += ' AND a.estado_servicio = ?';
    params.push(estado);
  }

  if (solo_agendados === '1') {
    query += ' AND a.id IS NOT NULL';
  }

  query += ' ORDER BY c.nombre ASC, a.creado_en DESC, hl.fin_llamada ASC';

  db.all(query, params, (err, clientes) => {
    if (err) {
      console.error('Error en /clientes-llamados:', err.message);
      return res.status(500).json({ error: 'Error al consultar clientes llamados' });
    }
    res.json({ clientes: clientes || [] });
  });
});

// ─── POST /api/llamadas/nuevo-agendamiento ───────────────────────────────
router.post('/nuevo-agendamiento', authMiddleware, async (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const { cliente_id, equipos, tipo_servicio, fecha_agendamiento, costo_cop, observaciones } = req.body;

  if (!cliente_id || !equipos || !tipo_servicio || !fecha_agendamiento) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (cliente, equipos, tipo, fecha)' });
  }

  db.get('SELECT * FROM clientes WHERE id = ? AND llamado = 1', [cliente_id], async (err, cliente) => {
    if (err || !cliente) return res.status(404).json({ error: 'Cliente no encontrado o no ha sido llamado' });

    const esCoord = req.user.rol === 'COORDINADOR';
    if (!esCoord && cliente.asignado_a !== userId) {
      return res.status(403).json({ error: 'No tienes permiso sobre este cliente' });
    }

    let client;
    try {
      client = await getClient();
      await client.query('BEGIN');

      const hlResult = await client.query(
        `INSERT INTO historial_llamadas (cliente_id, usuario_id, inicio_llamada, fin_llamada, duracion_segundos, observaciones, acepto_servicio, creado_en)
         VALUES ($1, $2, NOW(), NOW(), 0, $3, 1, NOW()) RETURNING id`,
        [cliente_id, userId, observaciones || 'Reagendamiento de servicio']
      );

      const agResult = await client.query(
        `INSERT INTO agendamientos (historial_id, cliente_id, usuario_id, equipos, tipo_servicio, fecha_agendamiento, costo_cop, estado_servicio, creado_en, actualizado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Agendado', NOW(), NOW()) RETURNING id`,
        [hlResult.rows[0].id, cliente_id, userId, equipos, tipo_servicio, fecha_agendamiento, parseFloat(costo_cop) || 0]
      );

      await client.query('COMMIT');
      res.status(201).json({ ok: true, agendamiento_id: agResult.rows[0].id });
    } catch (errTx) {
      if (client) try { await client.query('ROLLBACK'); } catch (e) {}
      console.error('Error en nuevo-agendamiento:', errTx.message);
      res.status(500).json({ error: 'Error al crear agendamiento' });
    } finally {
      if (client) client.release();
    }
  });
});

// ─── POST /api/llamadas/reprogramar ─────────────────────────────────────
router.post('/reprogramar', authMiddleware, (req, res) => {
  const db = getDb();
  const { cliente_id, agendamiento_id, fecha_reprogramacion, hora_reprogramacion, motivo } = req.body;

  if (!cliente_id || !fecha_reprogramacion || !hora_reprogramacion) {
    return res.status(400).json({ error: 'cliente_id, fecha_reprogramacion y hora_reprogramacion son requeridos' });
  }

  db.get('SELECT * FROM clientes WHERE id = ?', [cliente_id], (err, cliente) => {
    if (err || !cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    const esCoord = req.user.rol === 'COORDINADOR';
    if (!esCoord && cliente.asignado_a !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso sobre este cliente' });
    }

    console.log('[REPROGRAMAR] cliente_id:', cliente_id, 'user:', req.user.id, 'fecha:', fecha_reprogramacion, 'hora:', hora_reprogramacion);
    db.run(`
      INSERT INTO llamadas_reprogramadas (cliente_id, agendamiento_id, usuario_id, fecha_reprogramacion, hora_reprogramacion, motivo, creado_en)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [cliente_id, agendamiento_id || null, req.user.id, fecha_reprogramacion, hora_reprogramacion, motivo || null], function(errIns) {
      if (errIns) {
        console.error('Error al reprogramar llamada:', errIns.message, 'Params:', { cliente_id, agendamiento_id, fecha_reprogramacion, hora_reprogramacion });
        return res.status(500).json({ error: 'Error al crear reprogramación: ' + errIns.message });
      }
      res.status(201).json({ ok: true, id: this.lastID });
    });
  });
});

// ─── GET /api/llamadas/reprogramadas ────────────────────────────────────
router.get('/reprogramadas', authMiddleware, (req, res) => {
  const db = getDb();
  const esCoord = req.user.rol === 'COORDINADOR';
  const { asesora_id, todas } = req.query;

  let query = `
    SELECT r.id, r.cliente_id, r.agendamiento_id, r.usuario_id,
           r.fecha_reprogramacion, r.hora_reprogramacion, r.motivo, r.estado, r.creado_en,
           c.nombre, c.telefono, c.direccion, c.barrio, c.ciudad,
           u.nombre AS asesora_nombre,
           a.equipos, a.tipo_servicio, a.fecha_agendamiento, a.estado_servicio, a.costo_cop
    FROM llamadas_reprogramadas r
    JOIN clientes c ON r.cliente_id = c.id
    JOIN usuarios u ON r.usuario_id = u.id
    LEFT JOIN agendamientos a ON r.agendamiento_id = a.id
    WHERE 1=1
  `;
  const params = [];

  if (todas !== '1') {
    query += ' AND r.estado = ?';
    params.push('pendiente');
  }

  if (esCoord && asesora_id) {
    query += ' AND r.usuario_id = ?';
    params.push(asesora_id);
  } else if (!esCoord) {
    query += ' AND r.usuario_id = ?';
    params.push(req.user.id);
  }

  query += ' ORDER BY r.fecha_reprogramacion ASC, r.hora_reprogramacion ASC';

  db.all(query, params, (err, reprogramadas) => {
    if (err) {
      console.error('Error en /reprogramadas:', err.message);
      return res.status(500).json({ error: 'Error al consultar reprogramadas' });
    }
    res.json({ reprogramadas: reprogramadas || [] });
  });
});

// ─── PUT /api/llamadas/reprogramada/:id/completar ───────────────────────
router.put('/reprogramada/:id/completar', authMiddleware, (req, res) => {
  const db = getDb();
  const repId = req.params.id;
  const esCoord = req.user.rol === 'COORDINADOR';

  db.get('SELECT * FROM llamadas_reprogramadas WHERE id = ?', [repId], (err, rep) => {
    if (err || !rep) return res.status(404).json({ error: 'Reprogramación no encontrada' });

    if (!esCoord && rep.usuario_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para completar esta reprogramación' });
    }

    db.run("UPDATE llamadas_reprogramadas SET estado = 'completada' WHERE id = ?", [repId], function(errUpd) {
      if (errUpd) {
        console.error('Error al completar reprogramación:', errUpd.message);
        return res.status(500).json({ error: 'Error al completar reprogramación' });
      }
      res.json({ ok: true });
    });
  });
});

// ─── GET /api/llamadas/badges ─────────────────────────────────────────────
router.get('/badges', authMiddleware, (req, res) => {
  const db = getDb();
  const esCoord = req.user.rol === 'COORDINADOR';
  const esAsesora = req.user.rol === 'ASESORA';
  const userId = req.user.id;

  const hoy = new Date().toISOString().slice(0, 10);
  const ahora = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });

  // Reprogramadas pendientes para hoy
  const scopeReprog = esCoord ? '' : ' AND r.usuario_id = ?';
  const paramsReprog = esCoord ? [hoy] : [hoy, userId];
  db.get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN r.hora_reprogramacion <= ? THEN 1 ELSE 0 END) AS listas
     FROM llamadas_reprogramadas r
     WHERE r.estado = 'pendiente' AND r.fecha_reprogramacion = ?${scopeReprog}`,
    esCoord ? [ahora, hoy] : [ahora, hoy, userId],
    (err, reprog) => {
      if (err) return res.status(500).json({ error: err.message });

      // Cotizaciones vigentes pendientes
      const scopeCot = esAsesora ? ' AND co.asesora_id = ?' : '';
      const paramsCot = esAsesora ? [userId] : [];
      db.get(
        `SELECT COUNT(*) AS total FROM cotizaciones co WHERE co.estado IN ('pendiente', 'piensa')${scopeCot}`,
        paramsCot,
        (err2, cot) => {
          if (err2) return res.status(500).json({ error: err2.message });

          // Pendientes por cobro
          const scopeCobro = esCoord ? '' : ' AND a.usuario_id = ?';
          const paramsCobro = esCoord ? [] : [userId];
          db.get(
            `SELECT COUNT(*) AS total FROM agendamientos a WHERE a.metodo_pago = 'Pendiente por cobro'${scopeCobro}`,
            paramsCobro,
            (err3, cobro) => {
              if (err3) return res.status(500).json({ error: err3.message });

              // Servicios pendientes (Agendado) — para gestor/coordinador
              db.get(
                `SELECT COUNT(*) AS total FROM agendamientos WHERE estado_servicio = 'Agendado'`,
                [],
                (err4, servPend) => {
                  if (err4) return res.status(500).json({ error: err4.message });

                  // Pendientes por repuesto
                  db.get(
                    `SELECT COUNT(*) AS total FROM agendamientos WHERE estado_servicio = 'Pendiente por repuesto'`,
                    [],
                    (err5, servRep) => {
                      if (err5) return res.status(500).json({ error: err5.message });

                      res.json({
                        reprogramadas: { total: parseInt(reprog?.total || 0), listas: parseInt(reprog?.listas || 0) },
                        cotizaciones: parseInt(cot?.total || 0),
                        pendientesCobro: parseInt(cobro?.total || 0),
                        serviciosPendientes: parseInt(servPend?.total || 0),
                        pendientesRepuesto: parseInt(servRep?.total || 0),
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

module.exports = router;