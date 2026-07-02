process.env.TZ = 'America/Bogota';

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos (comprobantes de pago)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Rutas API ────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/llamadas', require('./routes/llamadas'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/descansos', require('./routes/descansos'));
app.use('/api/cotizaciones', require('./routes/cotizaciones'));

// ─── Frontend (produccion) ────────────────────────────────────────────────
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// ─── Health Check ─────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── SPA Fallback ────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ─── Error Handler ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`\nCRM INGETEG Server corriendo en http://localhost:${PORT}`);

  const { getDb } = require('./db');
  const db = getDb();
  db.get("SELECT COUNT(*) as cnt FROM usuarios", [], (err, row) => {
    if (!err && row && row.cnt === 0) {
      console.log('Base de datos vacia, creando usuarios iniciales...');
      const bcrypt = require('bcryptjs');
      const usuarios = [
        { username: 'coordinador', password: 'Ingeteg2024!', nombre: 'Coordinador Comercial', rol: 'COORDINADOR' },
        { username: 'gestor', password: 'Gestor01!', nombre: 'Gestor de Servicios', rol: 'GESTOR' },
        { username: 'asesora1', password: 'Asesora01!', nombre: 'Kelly Escobar', rol: 'ASESORA' },
        { username: 'asesora2', password: 'Asesora02!', nombre: 'Yesica Nunez', rol: 'ASESORA' },
        { username: 'asesora3', password: 'Asesora03!', nombre: 'Jessica Rivera', rol: 'ASESORA' },
        { username: 'asesora4', password: 'Asesora04!', nombre: 'Asesora Comercial 4', rol: 'ASESORA' },
      ];
      usuarios.forEach(u => {
        const hash = bcrypt.hashSync(u.password, 10);
        db.run("INSERT OR IGNORE INTO usuarios (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)",
          [u.username, hash, u.nombre, u.rol]);
      });
      console.log('Usuarios creados exitosamente.');
    }
  });
});

module.exports = app;
