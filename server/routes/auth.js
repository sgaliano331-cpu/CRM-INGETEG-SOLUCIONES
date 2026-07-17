const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const db = getDb();

  // Cambiado a consulta nativa compatible con sqlite3 estándar
  db.get('SELECT * FROM usuarios WHERE username = ? AND activo = 1', [username], (err, user) => {
    if (err) {
      console.error('Error en la consulta de login:', err.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    // Validamos de forma segura si el usuario existe y la contraseña coincide
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Generación del token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Respuesta exitosa
    return res.json({
      token,
      user: { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol },
    });
  });
});

// POST /api/auth/seed-tecnicos — crea técnicos si no existen
router.post('/seed-tecnicos', async (req, res) => {
  const { pool } = require('../db');
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

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ message: 'Sesión cerrada' });
});

module.exports = router;