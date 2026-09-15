const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { authMiddleware, soloCoordinador, JWT_SECRET } = require('../middleware/auth');

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
}

async function logLogin({ username, success, ip, userAgent, failureReason, userId }) {
  try {
    await pool.query(
      'INSERT INTO audit_login (username, success, ip_address, user_agent, failure_reason, user_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [username, success, ip, userAgent, failureReason || null, userId || null]
    );
  } catch (e) {
    console.error('Error registrando login:', e.message);
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
    const user = rows[0];

    if (!user) {
      await logLogin({ username, success: false, ip, userAgent, failureReason: 'usuario_no_encontrado' });
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    if (!user.activo) {
      await logLogin({ username, success: false, ip, userAgent, failureReason: 'usuario_inactivo', userId: user.id });
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
      await logLogin({ username, success: false, ip, userAgent, failureReason: 'contraseña_incorrecta', userId: user.id });
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const jti = uuidv4();
    const expiresIn = '4h';
    const token = jwt.sign(
      { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol, jti },
      JWT_SECRET,
      { expiresIn }
    );

    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO active_sessions (user_id, token_jti, ip_address, user_agent, expires_at) VALUES ($1,$2,$3,$4,$5)',
      [user.id, jti, ip, userAgent, expiresAt]
    );

    await logLogin({ username, success: true, ip, userAgent, userId: user.id });

    return res.json({
      token,
      user: { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol },
    });
  } catch (err) {
    console.error('Error en login:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (req.user.jti) {
      await pool.query('UPDATE active_sessions SET revoked_at = NOW() WHERE token_jti = $1', [req.user.jti]);
    }

    const jti = uuidv4();
    const expiresIn = '4h';
    const token = jwt.sign(
      { id: req.user.id, username: req.user.username, nombre: req.user.nombre, rol: req.user.rol, jti },
      JWT_SECRET,
      { expiresIn }
    );

    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO active_sessions (user_id, token_jti, ip_address, user_agent, expires_at) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, jti, ip, userAgent, expiresAt]
    );

    await logLogin({ username: req.user.username, success: true, ip, userAgent, failureReason: 'refresh', userId: req.user.id });

    return res.json({ token });
  } catch (err) {
    console.error('Error en refresh:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    if (req.user.jti) {
      await pool.query('UPDATE active_sessions SET revoked_at = NOW() WHERE token_jti = $1', [req.user.jti]);
    }
    res.json({ message: 'Sesión cerrada correctamente' });
  } catch (err) {
    res.json({ message: 'Sesión cerrada' });
  }
});

// POST /api/auth/seed-tecnicos — protegido, solo coordinador
router.post('/seed-tecnicos', authMiddleware, soloCoordinador, async (req, res) => {
  const tecnicos = [
    { username: 'hernan', password: 'Tecnico01!', nombre: 'HERNAN HERRERA', rol: 'TECNICO' },
    { username: 'omar', password: 'Tecnico02!', nombre: 'OMAR HERRERA', rol: 'TECNICO' },
    { username: 'sanchez', password: 'Tecnico03!', nombre: 'ANDRES SANCHEZ', rol: 'TECNICO' },
    { username: 'fredy', password: 'Tecnico04!', nombre: 'FREDY CASTAÑEDA', rol: 'TECNICO' },
  ];
  let creados = 0;
  try {
    for (const t of tecnicos) {
      const hash = bcrypt.hashSync(t.password, 10);
      const result = await pool.query(
        'INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING',
        [t.username, hash, t.nombre, t.rol]
      );
      if (result.rowCount > 0) creados++;
    }
    res.json({ ok: true, creados, mensaje: `${creados} técnicos creados` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
