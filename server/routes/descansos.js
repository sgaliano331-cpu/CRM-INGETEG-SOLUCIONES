const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware, soloCoordinador } = require('../middleware/auth');

// POST /api/descansos/salida — Marcar salida a descanso
router.post('/salida', authMiddleware, (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const { tipo } = req.body;

  const tiposValidos = ['Almuerzo', 'Desayuno', 'Pausa Activa'];
  if (!tipo || !tiposValidos.includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de descanso invalido' });
  }

  db.get(
    'SELECT id FROM descansos WHERE usuario_id = ? AND entrada IS NULL',
    [userId],
    (err, activo) => {
      if (err) return res.status(500).json({ error: err.message });
      if (activo) return res.status(400).json({ error: 'Ya tienes un descanso activo. Marca la entrada primero.' });

      const ahora = new Date().toISOString();
      db.run(
        'INSERT INTO descansos (usuario_id, tipo, salida) VALUES (?, ?, ?)',
        [userId, tipo, ahora],
        function (err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ ok: true, id: this.lastID, salida: ahora });
        }
      );
    }
  );
});

// PUT /api/descansos/entrada — Marcar entrada (regreso) de descanso
router.put('/entrada', authMiddleware, (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  db.get(
    'SELECT id, salida FROM descansos WHERE usuario_id = ? AND entrada IS NULL',
    [userId],
    (err, activo) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!activo) return res.status(400).json({ error: 'No tienes un descanso activo' });

      const ahora = new Date().toISOString();
      const salidaMs = new Date(activo.salida).getTime();
      const entradaMs = new Date(ahora).getTime();
      const duracionMin = Math.round((entradaMs - salidaMs) / 60000 * 100) / 100;

      db.run(
        'UPDATE descansos SET entrada = ?, duracion_minutos = ? WHERE id = ?',
        [ahora, duracionMin, activo.id],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ ok: true, entrada: ahora, duracion_minutos: duracionMin });
        }
      );
    }
  );
});

// GET /api/descansos/estado — Estado actual del descanso de la asesora
router.get('/estado', authMiddleware, (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  db.get(
    'SELECT id, tipo, salida FROM descansos WHERE usuario_id = ? AND entrada IS NULL',
    [userId],
    (err, activo) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ enDescanso: !!activo, descanso: activo || null });
    }
  );
});

// GET /api/descansos/historial — Historial de descansos de la asesora (hoy)
router.get('/historial', authMiddleware, (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  db.all(
    `SELECT id, tipo, salida, entrada, duracion_minutos
     FROM descansos
     WHERE usuario_id = ? AND date(salida) = date('now', 'localtime')
     ORDER BY salida DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ descansos: rows || [] });
    }
  );
});

// GET /api/descansos/auditoria — Reporte para coordinador
router.get('/auditoria', authMiddleware, soloCoordinador, (req, res) => {
  const db = getDb();
  const { asesora_id, fecha_desde, fecha_hasta } = req.query;

  let where = 'WHERE d.entrada IS NOT NULL';
  const params = [];

  if (asesora_id) {
    where += ' AND d.usuario_id = ?';
    params.push(asesora_id);
  }
  if (fecha_desde) {
    where += ' AND date(d.salida) >= ?';
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    where += ' AND date(d.salida) <= ?';
    params.push(fecha_hasta);
  }

  const queryDetalle = `
    SELECT d.id, u.nombre AS asesora, d.tipo, d.salida, d.entrada,
      d.duracion_minutos
    FROM descansos d
    JOIN usuarios u ON d.usuario_id = u.id
    ${where}
    ORDER BY d.salida DESC
    LIMIT 500
  `;

  db.all(queryDetalle, params, (err, registros) => {
    if (err) return res.status(500).json({ error: err.message });

    const queryResumen = `
      SELECT u.nombre AS asesora, u.id AS usuario_id, d.tipo,
        COUNT(d.id) AS total_descansos,
        ROUND(SUM(d.duracion_minutos), 1) AS tiempo_total_min,
        ROUND(AVG(d.duracion_minutos), 1) AS tiempo_promedio_min
      FROM descansos d
      JOIN usuarios u ON d.usuario_id = u.id
      ${where}
      GROUP BY d.usuario_id, d.tipo
      ORDER BY u.nombre, d.tipo
    `;

    db.all(queryResumen, params, (err2, resumen) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ registros: registros || [], resumen: resumen || [] });
    });
  });
});

module.exports = router;
