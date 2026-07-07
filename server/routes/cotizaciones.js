const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware, gestorOCoordinador } = require('../middleware/auth');

// POST /api/cotizaciones — Crear cotizacion (cuando gestor marca Pendiente por repuesto)
router.post('/', authMiddleware, gestorOCoordinador, (req, res) => {
  const db = getDb();
  const { agendamiento_id, valor_cotizacion, observacion_gestor } = req.body;

  if (!agendamiento_id || !valor_cotizacion) {
    return res.status(400).json({ error: 'Agendamiento y valor de cotizacion son requeridos' });
  }

  db.get('SELECT cliente_id, usuario_id FROM agendamientos WHERE id = ?', [agendamiento_id], (err, ag) => {
    if (err || !ag) return res.status(404).json({ error: 'Agendamiento no encontrado' });

    db.run(
      `INSERT INTO cotizaciones (agendamiento_id, cliente_id, asesora_id, gestor_id, valor_cotizacion, observacion_gestor)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [agendamiento_id, ag.cliente_id, ag.usuario_id, req.user.id, parseFloat(valor_cotizacion), observacion_gestor || null],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ ok: true, id: this.lastID });
      }
    );
  });
});

// GET /api/cotizaciones/vigentes — Lista para asesora (pendientes + piensa)
router.get('/vigentes', authMiddleware, (req, res) => {
  const db = getDb();
  const esAsesora = req.user.rol === 'ASESORA';

  let query = `
    SELECT co.id, co.agendamiento_id, co.valor_cotizacion, co.observacion_gestor,
           co.observacion_asesora, co.estado, co.llamado, co.creado_en,
           c.nombre, c.telefono, c.direccion, c.barrio, c.ciudad,
           a.equipos, a.tipo_servicio, a.fecha_agendamiento,
           u_gestor.nombre AS gestor_nombre, u_asesora.nombre AS asesora_nombre
    FROM cotizaciones co
    JOIN clientes c ON co.cliente_id = c.id
    JOIN agendamientos a ON co.agendamiento_id = a.id
    JOIN usuarios u_gestor ON co.gestor_id = u_gestor.id
    JOIN usuarios u_asesora ON co.asesora_id = u_asesora.id
    WHERE co.estado IN ('pendiente', 'piensa')
  `;
  const params = [];

  if (esAsesora) {
    query += ' AND co.asesora_id = ?';
    params.push(req.user.id);
  }

  query += ' ORDER BY co.llamado ASC, co.creado_en DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ cotizaciones: rows || [] });
  });
});

// PUT /api/cotizaciones/:id/resultado — Asesora marca resultado de llamada
router.put('/:id/resultado', authMiddleware, (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { estado, observacion_asesora, agendamiento_data } = req.body;

  const estadosValidos = ['agendado', 'piensa', 'rechazado'];
  if (!estado || !estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado invalido' });
  }

  db.get('SELECT * FROM cotizaciones WHERE id = ?', [id], (err, cot) => {
    if (err || !cot) return res.status(404).json({ error: 'Cotizacion no encontrada' });

    db.run(
      'UPDATE cotizaciones SET estado = ?, observacion_asesora = ?, llamado = 1 WHERE id = ?',
      [estado, observacion_asesora || null, id],
      (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });

        if (estado === 'agendado' && agendamiento_data) {
          const { equipos, tipo_servicio, fecha_agendamiento, costo_cop } = agendamiento_data;

          db.run(
            "UPDATE agendamientos SET estado_servicio = 'Cumplido', actualizado_en = NOW() WHERE id = ?",
            [cot.agendamiento_id],
            (errUpd) => {
              if (errUpd) console.error('Error marcando orden original como cumplida:', errUpd.message);

              db.get(
                'SELECT MAX(id) AS hid FROM historial_llamadas WHERE cliente_id = ?',
                [cot.cliente_id],
                (errH, rowH) => {
                  const histId = rowH?.hid;
                  if (!histId) return res.json({ ok: true });

                  db.run(
                    `INSERT INTO agendamientos (historial_id, cliente_id, usuario_id, equipos, tipo_servicio, fecha_agendamiento, costo_cop)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [histId, cot.cliente_id, cot.asesora_id, equipos, tipo_servicio, fecha_agendamiento, parseFloat(costo_cop) || 0],
                    (err3) => {
                      if (err3) return res.status(500).json({ error: err3.message });
                      res.json({ ok: true });
                    }
                  );
                }
              );
            }
          );
        } else if (estado === 'rechazado') {
          db.run(
            "UPDATE agendamientos SET estado_servicio = 'Cumplido', actualizado_en = NOW() WHERE id = ?",
            [cot.agendamiento_id],
            () => res.json({ ok: true })
          );
        } else {
          res.json({ ok: true });
        }
      }
    );
  });
});

module.exports = router;
