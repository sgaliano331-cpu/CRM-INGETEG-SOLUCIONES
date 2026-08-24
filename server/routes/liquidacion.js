const express = require('express');
const router = express.Router();
const { authMiddleware, soloCoordinador } = require('../middleware/auth');
const { pool } = require('../db');

router.use(authMiddleware, soloCoordinador);

// GET /api/liquidacion/tarifas
router.get('/tarifas', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tarifas_tecnico WHERE activo = 1 ORDER BY tipo, nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/liquidacion/tarifas
router.post('/tarifas', async (req, res) => {
  const { tipo, nombre, valor_tecnico, tipo_servicio } = req.body;
  if (!tipo || !nombre) return res.status(400).json({ error: 'tipo y nombre requeridos' });
  const ts = tipo === 'repuesto' ? 'Mantenimiento' : (tipo_servicio || 'Mantenimiento');
  try {
    await pool.query(
      `INSERT INTO tarifas_tecnico (tipo, nombre, valor_tecnico, tipo_servicio)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tipo, nombre, tipo_servicio) DO UPDATE SET valor_tecnico = $3`,
      [tipo, nombre.trim(), parseFloat(valor_tecnico) || 0, ts]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/liquidacion/tarifas/:id
router.put('/tarifas/:id', async (req, res) => {
  const { valor_tecnico } = req.body;
  try {
    await pool.query('UPDATE tarifas_tecnico SET valor_tecnico = $1 WHERE id = $2', [parseFloat(valor_tecnico) || 0, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/liquidacion/tarifas/:id
router.delete('/tarifas/:id', async (req, res) => {
  try {
    await pool.query('UPDATE tarifas_tecnico SET activo = 0 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/liquidacion/informe?tecnico=X&desde=Y&hasta=Z
router.get('/informe', async (req, res) => {
  const { tecnico, desde, hasta } = req.query;
  if (!tecnico) return res.status(400).json({ error: 'tecnico requerido' });

  try {
    let dateFilter = '';
    const params = [tecnico];

    if (desde && hasta) {
      dateFilter = ' AND a.fecha_agendamiento >= $2 AND a.fecha_agendamiento <= $3';
      params.push(desde, hasta);
    } else if (desde) {
      dateFilter = ' AND a.fecha_agendamiento >= $2';
      params.push(desde);
    }

    const { rows: servicios } = await pool.query(`
      SELECT a.id, a.equipos, a.costo_cop, a.tipo_servicio, a.estado_servicio,
             a.fecha_agendamiento, a.fecha_atencion, a.liquidado,
             c.nombre as cliente, c.direccion, c.ciudad
      FROM agendamientos a
      JOIN clientes c ON c.id = a.cliente_id
      WHERE a.tecnico = $1 AND a.estado_servicio = 'Cumplido'${dateFilter}
      ORDER BY a.fecha_agendamiento DESC, a.id DESC
    `, params);

    if (servicios.length === 0) return res.json({ servicios: [], tarifas_equipo: [], tarifas_repuesto: [] });

    const ids = servicios.map(s => s.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');

    const { rows: repuestos } = await pool.query(`
      SELECT d.agendamiento_id, r.nombre, r.cantidad, r.valor_unitario, r.valor_total
      FROM detalle_servicio_tecnico d
      JOIN repuestos_usados r ON r.detalle_id = d.id
      WHERE d.agendamiento_id IN (${placeholders})
      ORDER BY d.agendamiento_id, r.id
    `, ids);

    const { rows: tarifas } = await pool.query('SELECT * FROM tarifas_tecnico WHERE activo = 1');
    // Key: "tipo_servicio|equipo_nombre" -> valor
    const tarifasEquipo = {};
    const tarifasRepuesto = {};
    for (const t of tarifas) {
      const ts = (t.tipo_servicio || 'Mantenimiento').toLowerCase();
      if (t.tipo === 'equipo') tarifasEquipo[`${ts}|${t.nombre.toLowerCase()}`] = t.valor_tecnico;
      else if (t.tipo === 'repuesto') tarifasRepuesto[t.nombre.toLowerCase()] = t.valor_tecnico;
    }

    const tarifasCombo = {};
    for (const t of tarifas) {
      if (t.tipo === 'combo') {
        const ts = (t.tipo_servicio || 'Mantenimiento').toLowerCase();
        const key = t.nombre.split('+').map(e => e.trim().toLowerCase()).sort().join('+');
        tarifasCombo[`${ts}|${key}`] = t.valor_tecnico;
      }
    }

    const resultado = servicios.map(s => {
      const equiposList = (s.equipos || '').split(',').map(e => e.trim()).filter(Boolean);
      const ts = (s.tipo_servicio || 'Mantenimiento').toLowerCase();

      // Check for combo match
      const eqKey = equiposList.map(e => e.toLowerCase()).sort().join('+');
      const comboTarifa = tarifasCombo[`${ts}|${eqKey}`];

      let equiposDesglose;
      let totalEquipos;

      if (comboTarifa !== undefined && equiposList.length > 1) {
        equiposDesglose = equiposList.map(eq => ({ nombre: eq, tarifa: 0 }));
        equiposDesglose.push({ nombre: 'Combo: ' + equiposList.join(' + '), tarifa: comboTarifa, esCombo: true });
        totalEquipos = comboTarifa;
      } else {
        equiposDesglose = equiposList.map(eq => ({
          nombre: eq,
          tarifa: tarifasEquipo[`${ts}|${eq.toLowerCase()}`] || 0,
        }));
        totalEquipos = equiposDesglose.reduce((sum, e) => sum + e.tarifa, 0);
      }

      const reps = repuestos.filter(r => r.agendamiento_id === s.id);
      const repsDesglose = reps.map(r => ({
        nombre: r.nombre,
        cantidad: r.cantidad,
        valor_cobrado: r.valor_total,
        tarifa_tecnico: tarifasRepuesto[r.nombre.toLowerCase()] || 0,
        total_tecnico: (tarifasRepuesto[r.nombre.toLowerCase()] || 0) * r.cantidad,
      }));
      const totalRepuestos = repsDesglose.reduce((sum, r) => sum + r.total_tecnico, 0);

      return {
        id: s.id,
        fecha: s.fecha_agendamiento,
        cliente: s.cliente,
        tipo_servicio: s.tipo_servicio,
        equipos: s.equipos,
        equipos_desglose: equiposDesglose,
        mano_obra_cobrada: s.costo_cop,
        honorario_equipos: totalEquipos,
        repuestos: repsDesglose,
        honorario_repuestos: totalRepuestos,
        total_tecnico: totalEquipos + totalRepuestos,
        liquidado: s.liquidado,
      };
    });

    res.json({
      servicios: resultado,
      tarifas_equipo: tarifas.filter(t => t.tipo === 'equipo'),
      tarifas_repuesto: tarifas.filter(t => t.tipo === 'repuesto'),
      tarifas_combo: tarifas.filter(t => t.tipo === 'combo'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/liquidacion/items — equipos y repuestos distintos ya usados
router.get('/items', async (req, res) => {
  try {
    const { rows: eqRows } = await pool.query(
      "SELECT DISTINCT equipos FROM agendamientos WHERE equipos IS NOT NULL AND equipos != ''"
    );
    const equiposSet = new Set();
    for (const r of eqRows) {
      r.equipos.split(',').map(e => e.trim()).filter(Boolean).forEach(e => equiposSet.add(e));
    }

    const { rows: repRows } = await pool.query(
      'SELECT DISTINCT nombre FROM repuestos_usados WHERE nombre IS NOT NULL ORDER BY nombre'
    );

    res.json({
      equipos: [...equiposSet].sort(),
      repuestos: repRows.map(r => r.nombre),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/liquidacion/tecnicos
router.get('/tecnicos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT a.tecnico, COUNT(*) FILTER (WHERE a.estado_servicio = 'Cumplido') as cumplidos
      FROM agendamientos a
      WHERE a.tecnico IS NOT NULL AND a.tecnico != '' AND a.tecnico NOT LIKE '%Prueba%'
      GROUP BY a.tecnico
      ORDER BY a.tecnico
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/liquidacion/marcar-liquidado
router.put('/marcar-liquidado', async (req, res) => {
  const { ids } = req.body;
  if (!ids || ids.length === 0) return res.status(400).json({ error: 'ids requeridos' });
  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await pool.query(
      `UPDATE agendamientos SET liquidado = 1, fecha_liquidacion = NOW() WHERE id IN (${placeholders})`,
      ids
    );
    res.json({ ok: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
