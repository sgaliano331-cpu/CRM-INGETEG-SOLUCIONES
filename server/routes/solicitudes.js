const express = require('express');
const router = express.Router();
const { getDb, getClient } = require('../db');
const { authMiddleware, soloCoordinador } = require('../middleware/auth');
const { eliminarEventoCalendario, moverEventoCalendario, crearEventoAgendamiento } = require('../google-calendar');

// ─── POST /api/solicitudes — Crear solicitud (asesora) ──────────────────
router.post('/', authMiddleware, async (req, res) => {
  const { agendamiento_id, tipo, nueva_fecha, nueva_hora_inicio, nueva_hora_fin, motivo } = req.body;
  if (!agendamiento_id || !tipo) return res.status(400).json({ error: 'agendamiento_id y tipo requeridos' });
  if (tipo === 'reprogramar' && !nueva_fecha) return res.status(400).json({ error: 'nueva_fecha requerida para reprogramar' });

  try {
    const client = await getClient();
    const check = await client.query(
      'SELECT id, usuario_id, estado_servicio FROM agendamientos WHERE id = $1',
      [agendamiento_id]
    );
    if (!check.rows.length) { client.release(); return res.status(404).json({ error: 'Agendamiento no encontrado' }); }
    const ag = check.rows[0];
    if (req.user.rol === 'ASESORA' && ag.usuario_id !== req.user.id) { client.release(); return res.status(403).json({ error: 'No autorizado' }); }
    if (ag.estado_servicio !== 'Agendado') { client.release(); return res.status(400).json({ error: 'Solo se pueden modificar servicios en estado Agendado' }); }

    const pending = await client.query(
      "SELECT id FROM solicitudes_cambio WHERE agendamiento_id = $1 AND estado = 'pendiente'",
      [agendamiento_id]
    );
    if (pending.rows.length) { client.release(); return res.status(400).json({ error: 'Ya existe una solicitud pendiente para este servicio' }); }

    const result = await client.query(
      `INSERT INTO solicitudes_cambio (agendamiento_id, usuario_id, tipo, nueva_fecha, nueva_hora_inicio, nueva_hora_fin, motivo)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [agendamiento_id, req.user.id, tipo, nueva_fecha || null, nueva_hora_inicio || null, nueva_hora_fin || null, motivo || null]
    );
    client.release();
    res.json({ ok: true, solicitud_id: result.rows[0].id });
  } catch (err) {
    console.error('Error creando solicitud:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/solicitudes — Listar solicitudes ──────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const client = await getClient();
    const esAsesora = req.user.rol === 'ASESORA';
    let query = `
      SELECT s.*, a.fecha_agendamiento, a.hora_inicio AS hora_actual, a.hora_fin AS hora_actual_fin,
             a.equipos, a.tipo_servicio, a.tecnico, a.costo_cop,
             c.nombre AS cliente_nombre, c.telefono, c.barrio,
             u.nombre AS solicitante_nombre,
             r.nombre AS revisor_nombre
      FROM solicitudes_cambio s
      JOIN agendamientos a ON s.agendamiento_id = a.id
      JOIN clientes c ON a.cliente_id = c.id
      JOIN usuarios u ON s.usuario_id = u.id
      LEFT JOIN usuarios r ON s.revisado_por = r.id
    `;
    const params = [];
    if (esAsesora) {
      query += ' WHERE s.usuario_id = $1';
      params.push(req.user.id);
    }
    query += ' ORDER BY s.creado_en DESC LIMIT 100';
    const result = await client.query(query, params);
    client.release();
    res.json({ solicitudes: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/solicitudes/pendientes-count — Badge count ────────────────
router.get('/pendientes-count', authMiddleware, async (req, res) => {
  try {
    const client = await getClient();
    const result = await client.query("SELECT COUNT(*) AS total FROM solicitudes_cambio WHERE estado = 'pendiente'");
    client.release();
    res.json({ total: parseInt(result.rows[0].total) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/solicitudes/:id/aprobar — Aprobar solicitud (coordinador) ─
router.put('/:id/aprobar', authMiddleware, soloCoordinador, async (req, res) => {
  try {
    const client = await getClient();
    const sol = await client.query(
      `SELECT s.*, a.tecnico, a.google_event_id, a.fecha_agendamiento, a.hora_inicio, a.hora_fin,
              a.tipo_servicio, a.equipos, a.costo_cop, a.observaciones_tecnica, a.usuario_id,
              c.nombre AS cliente_nombre, c.telefono, c.direccion, c.barrio, c.ciudad,
              u.nombre AS asesora_nombre
       FROM solicitudes_cambio s
       JOIN agendamientos a ON s.agendamiento_id = a.id
       JOIN clientes c ON a.cliente_id = c.id
       JOIN usuarios u ON a.usuario_id = u.id
       WHERE s.id = $1 AND s.estado = 'pendiente'`,
      [req.params.id]
    );
    if (!sol.rows.length) { client.release(); return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' }); }

    const s = sol.rows[0];

    if (s.tipo === 'cancelar') {
      await client.query(
        "UPDATE agendamientos SET estado_servicio = 'Cancelado por el cliente', actualizado_en = NOW() WHERE id = $1",
        [s.agendamiento_id]
      );
      if (s.tecnico && s.google_event_id) {
        await eliminarEventoCalendario(s.tecnico, s.google_event_id);
      }
    } else if (s.tipo === 'reprogramar') {
      await client.query(
        'UPDATE agendamientos SET fecha_agendamiento = $1, hora_inicio = $2, hora_fin = $3, actualizado_en = NOW() WHERE id = $4',
        [s.nueva_fecha, s.nueva_hora_inicio || s.hora_inicio, s.nueva_hora_fin || s.hora_fin, s.agendamiento_id]
      );
      if (s.tecnico && s.google_event_id) {
        await moverEventoCalendario(s.tecnico, s.google_event_id, s.nueva_fecha, s.nueva_hora_inicio || s.hora_inicio, s.nueva_hora_fin || s.hora_fin);
      } else if (s.tecnico && !s.google_event_id) {
        const eventId = await crearEventoAgendamiento({
          clienteNombre: s.cliente_nombre, clienteDireccion: s.direccion, clienteBarrio: s.barrio,
          clienteCiudad: s.ciudad, clienteTelefono: s.telefono,
          equipos: s.equipos, tipoServicio: s.tipo_servicio, fecha: s.nueva_fecha,
          horaInicio: s.nueva_hora_inicio || s.hora_inicio, horaFin: s.nueva_hora_fin || s.hora_fin,
          costoCop: s.costo_cop, observaciones: s.observaciones_tecnica, tecnico: s.tecnico, asesora: s.asesora_nombre,
        });
        if (eventId) {
          await client.query('UPDATE agendamientos SET google_event_id = $1 WHERE id = $2', [eventId, s.agendamiento_id]);
        }
      }
    }

    await client.query(
      "UPDATE solicitudes_cambio SET estado = 'aprobada', revisado_por = $1, revisado_en = NOW() WHERE id = $2",
      [req.user.id, req.params.id]
    );
    client.release();
    res.json({ ok: true });
  } catch (err) {
    console.error('Error aprobando solicitud:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/solicitudes/:id/rechazar — Rechazar solicitud ─────────────
router.put('/:id/rechazar', authMiddleware, soloCoordinador, async (req, res) => {
  try {
    const client = await getClient();
    const result = await client.query(
      "UPDATE solicitudes_cambio SET estado = 'rechazada', revisado_por = $1, revisado_en = NOW() WHERE id = $2 AND estado = 'pendiente' RETURNING id",
      [req.user.id, req.params.id]
    );
    client.release();
    if (!result.rows.length) return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
