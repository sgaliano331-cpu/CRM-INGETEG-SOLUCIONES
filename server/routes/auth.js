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

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ message: 'Sesión cerrada' });
});

module.exports = router;