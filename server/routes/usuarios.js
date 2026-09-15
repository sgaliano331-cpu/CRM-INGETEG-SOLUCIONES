const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authMiddleware, soloCoordinador } = require('../middleware/auth');
const { pool } = require('../db');
const { logAudit, getClientIp } = require('../middleware/auditLogger');

// GET /api/usuarios — List all users
router.get('/', authMiddleware, soloCoordinador, (req, res) => {
  pool.query('SELECT id, username, nombre, rol, activo, creado_en FROM usuarios ORDER BY rol, nombre')
    .then(({ rows }) => res.json(rows))
    .catch(err => res.status(500).json({ error: err.message }));
});

// POST /api/usuarios — Create user
router.post('/', authMiddleware, soloCoordinador, async (req, res) => {
  const { username, nombre, password, rol } = req.body;

  if (!username || !nombre || !password || !rol) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const rolesValidos = ['COORDINADOR', 'GESTOR', 'ASESORA', 'TECNICO'];
  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({ error: 'Rol no valido' });
  }

  try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE username = $1', [username.toLowerCase()]);
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES ($1, $2, $3, $4) RETURNING id, username, nombre, rol, activo',
      [username.toLowerCase(), hash, nombre, rol]
    );
    await logAudit({ userId: req.user.id, username: req.user.username, action: 'INSERT', tableName: 'usuarios', recordId: result.rows[0].id, newValues: { username: username.toLowerCase(), nombre, rol }, ip: getClientIp(req) });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/usuarios/:id/password — Change password
router.put('/:id/password', authMiddleware, soloCoordinador, async (req, res) => {
  const { password } = req.body;
  const id = parseInt(req.params.id);

  if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número' });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2 RETURNING id, nombre', [hash, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    await logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', tableName: 'usuarios', recordId: id, newValues: { password_changed: true }, ip: getClientIp(req) });
    res.json({ message: `Contrasena actualizada para ${result.rows[0].nombre}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/usuarios/:id/toggle — Activate/deactivate
router.put('/:id/toggle', authMiddleware, soloCoordinador, async (req, res) => {
  const id = parseInt(req.params.id);

  if (id === req.user.id) {
    return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });
  }

  try {
    const oldResult = await pool.query('SELECT activo FROM usuarios WHERE id = $1', [id]);
    const result = await pool.query(
      'UPDATE usuarios SET activo = CASE WHEN activo = 1 THEN 0 ELSE 1 END WHERE id = $1 RETURNING id, nombre, activo',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    const u = result.rows[0];
    await logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', tableName: 'usuarios', recordId: id, oldValues: { activo: oldResult.rows[0]?.activo }, newValues: { activo: u.activo }, ip: getClientIp(req) });
    res.json({ message: `${u.nombre} ${u.activo === 1 ? 'activado' : 'desactivado'}`, activo: u.activo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/usuarios/:id — Update user info (name, role)
router.put('/:id', authMiddleware, soloCoordinador, async (req, res) => {
  const id = parseInt(req.params.id);
  const { nombre, rol } = req.body;

  const rolesValidos = ['COORDINADOR', 'GESTOR', 'ASESORA', 'TECNICO'];
  if (rol && !rolesValidos.includes(rol)) {
    return res.status(400).json({ error: 'Rol no valido' });
  }

  const { username } = req.body;

  try {
    if (username) {
      const existe = await pool.query('SELECT id FROM usuarios WHERE username = $1 AND id != $2', [username.toLowerCase(), id]);
      if (existe.rows.length > 0) {
        return res.status(400).json({ error: 'El nombre de usuario ya existe' });
      }
    }

    const sets = [];
    const params = [];
    let idx = 1;

    if (username) { sets.push(`username = $${idx++}`); params.push(username.toLowerCase()); }
    if (nombre) { sets.push(`nombre = $${idx++}`); params.push(nombre); }
    if (rol) { sets.push(`rol = $${idx++}`); params.push(rol); }

    if (sets.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    const oldResult = await pool.query('SELECT username, nombre, rol FROM usuarios WHERE id = $1', [id]);
    params.push(id);
    const result = await pool.query(
      `UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, username, nombre, rol, activo`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    await logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', tableName: 'usuarios', recordId: id, oldValues: oldResult.rows[0], newValues: { username, nombre, rol }, ip: getClientIp(req) });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
