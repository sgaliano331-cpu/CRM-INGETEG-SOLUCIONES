const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authMiddleware, soloCoordinador } = require('../middleware/auth');

router.use(authMiddleware, soloCoordinador);

// GET /api/audit/logins
router.get('/logins', async (req, res) => {
  try {
    const { username, success, desde, hasta, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    let params = [];
    let i = 1;

    if (username) { where.push(`username ILIKE $${i++}`); params.push(`%${username}%`); }
    if (success !== undefined) { where.push(`success = $${i++}`); params.push(success === 'true'); }
    if (desde) { where.push(`created_at >= $${i++}`); params.push(desde); }
    if (hasta) { where.push(`created_at <= $${i++}`); params.push(hasta + ' 23:59:59'); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = await pool.query(`SELECT COUNT(*) as total FROM audit_login ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].total);

    params.push(parseInt(limit));
    params.push(offset);
    const { rows } = await pool.query(
      `SELECT * FROM audit_login ${whereClause} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      params
    );

    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit/actions
router.get('/actions', async (req, res) => {
  try {
    const { username, table_name, action, desde, hasta, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    let params = [];
    let i = 1;

    if (username) { where.push(`username ILIKE $${i++}`); params.push(`%${username}%`); }
    if (table_name) { where.push(`table_name = $${i++}`); params.push(table_name); }
    if (action) { where.push(`action = $${i++}`); params.push(action); }
    if (desde) { where.push(`created_at >= $${i++}`); params.push(desde); }
    if (hasta) { where.push(`created_at <= $${i++}`); params.push(hasta + ' 23:59:59'); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = await pool.query(`SELECT COUNT(*) as total FROM audit_actions ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].total);

    params.push(parseInt(limit));
    params.push(offset);
    const { rows } = await pool.query(
      `SELECT * FROM audit_actions ${whereClause} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      params
    );

    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit/sessions
router.get('/sessions', async (req, res) => {
  try {
    const { user_id, activas, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    let params = [];
    let i = 1;

    if (user_id) { where.push(`s.user_id = $${i++}`); params.push(parseInt(user_id)); }
    if (activas === 'true') { where.push(`s.revoked_at IS NULL AND s.expires_at > NOW()`); }
    if (activas === 'false') { where.push(`(s.revoked_at IS NOT NULL OR s.expires_at <= NOW())`); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = await pool.query(`SELECT COUNT(*) as total FROM active_sessions s ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].total);

    params.push(parseInt(limit));
    params.push(offset);
    const { rows } = await pool.query(
      `SELECT s.*, u.username, u.nombre FROM active_sessions s LEFT JOIN usuarios u ON u.id = s.user_id ${whereClause} ORDER BY s.created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      params
    );

    res.json({ data: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit/stats
router.get('/stats', async (req, res) => {
  try {
    const [loginsFallidos, sesionesActivas, accionesHoy, loginsHoy] = await Promise.all([
      pool.query("SELECT COUNT(*) as total FROM audit_login WHERE success = false AND created_at > NOW() - INTERVAL '24 hours'"),
      pool.query("SELECT COUNT(*) as total FROM active_sessions WHERE revoked_at IS NULL AND expires_at > NOW()"),
      pool.query("SELECT COUNT(*) as total FROM audit_actions WHERE created_at > NOW() - INTERVAL '24 hours'"),
      pool.query("SELECT COUNT(*) as total FROM audit_login WHERE success = true AND created_at > NOW() - INTERVAL '24 hours'"),
    ]);

    res.json({
      logins_fallidos_24h: parseInt(loginsFallidos.rows[0].total),
      sesiones_activas: parseInt(sesionesActivas.rows[0].total),
      acciones_hoy: parseInt(accionesHoy.rows[0].total),
      logins_exitosos_24h: parseInt(loginsHoy.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
