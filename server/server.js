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

  const fs = require('fs');
  const { getDb } = require('./db');
  const db = getDb();

  db.get("SELECT COUNT(*) as cnt FROM clientes", [], (err, row) => {
    if (!err && row && row.cnt === 0) {
      const seedPath = path.join(__dirname, 'seed_data.json');
      if (fs.existsSync(seedPath)) {
        console.log('Base de datos vacia, restaurando datos desde seed_data.json...');
        const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

        db.serialize(() => {
          db.run("BEGIN TRANSACTION");

          if (data.usuarios) {
            const stmt = db.prepare('INSERT OR IGNORE INTO usuarios (id, username, password_hash, nombre, rol, activo, creado_en) VALUES (?,?,?,?,?,?,?)');
            data.usuarios.forEach(u => stmt.run([u.id, u.username, u.password_hash, u.nombre, u.rol, u.activo, u.creado_en]));
            stmt.finalize();
            console.log('Usuarios:', data.usuarios.length);
          }

          if (data.clientes) {
            const stmt = db.prepare('INSERT OR IGNORE INTO clientes (id, nombre, telefono, direccion, barrio, ciudad, asignado_a, posicion_cola, prioridad, llamado, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
            data.clientes.forEach(c => stmt.run([c.id, c.nombre, c.telefono, c.direccion, c.barrio, c.ciudad, c.asignado_a, c.posicion_cola, c.prioridad, c.llamado, c.creado_en, c.actualizado_en]));
            stmt.finalize();
            console.log('Clientes:', data.clientes.length);
          }

          if (data.historial_llamadas) {
            const stmt = db.prepare('INSERT OR IGNORE INTO historial_llamadas (id, cliente_id, usuario_id, inicio_llamada, fin_llamada, duracion_segundos, observaciones, acepto_servicio, creado_en) VALUES (?,?,?,?,?,?,?,?,?)');
            data.historial_llamadas.forEach(h => stmt.run([h.id, h.cliente_id, h.usuario_id, h.inicio_llamada, h.fin_llamada, h.duracion_segundos, h.observaciones, h.acepto_servicio, h.creado_en]));
            stmt.finalize();
            console.log('Historial llamadas:', data.historial_llamadas.length);
          }

          if (data.agendamientos) {
            const stmt = db.prepare('INSERT OR IGNORE INTO agendamientos (id, historial_id, cliente_id, usuario_id, equipos, tipo_servicio, fecha_agendamiento, costo_cop, estado_servicio, metodo_pago, observaciones_tecnica, comprobante_pago_url, creado_en, actualizado_en, id_servicio, tecnico, fecha_atencion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
            data.agendamientos.forEach(a => stmt.run([a.id, a.historial_id, a.cliente_id, a.usuario_id, a.equipos, a.tipo_servicio, a.fecha_agendamiento, a.costo_cop, a.estado_servicio, a.metodo_pago, a.observaciones_tecnica, a.comprobante_pago_url, a.creado_en, a.actualizado_en, a.id_servicio||null, a.tecnico||null, a.fecha_atencion||null]));
            stmt.finalize();
            console.log('Agendamientos:', data.agendamientos.length);
          }

          if (data.descansos) {
            const stmt = db.prepare('INSERT OR IGNORE INTO descansos (id, usuario_id, tipo, salida, entrada, duracion_minutos, creado_en) VALUES (?,?,?,?,?,?,?)');
            data.descansos.forEach(d => stmt.run([d.id, d.usuario_id, d.tipo, d.salida, d.entrada, d.duracion_minutos, d.creado_en]));
            stmt.finalize();
            console.log('Descansos:', data.descansos.length);
          }

          if (data.cotizaciones) {
            const stmt = db.prepare('INSERT OR IGNORE INTO cotizaciones (id, agendamiento_id, cliente_id, asesora_id, gestor_id, valor_cotizacion, observacion_gestor, observacion_asesora, estado, llamado, creado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
            data.cotizaciones.forEach(c => stmt.run([c.id, c.agendamiento_id, c.cliente_id, c.asesora_id, c.gestor_id, c.valor_cotizacion, c.observacion_gestor, c.observacion_asesora, c.estado, c.llamado, c.creado_en]));
            stmt.finalize();
            console.log('Cotizaciones:', data.cotizaciones.length);
          }

          if (data.llamadas_reprogramadas) {
            const stmt = db.prepare('INSERT OR IGNORE INTO llamadas_reprogramadas (id, cliente_id, agendamiento_id, usuario_id, fecha_reprogramacion, hora_reprogramacion, motivo, estado, creado_en) VALUES (?,?,?,?,?,?,?,?,?)');
            data.llamadas_reprogramadas.forEach(r => stmt.run([r.id, r.cliente_id, r.agendamiento_id, r.usuario_id, r.fecha_reprogramacion, r.hora_reprogramacion, r.motivo, r.estado, r.creado_en]));
            stmt.finalize();
            console.log('Reprogramadas:', data.llamadas_reprogramadas.length);
          }

          db.run("COMMIT", (errC) => {
            if (errC) console.error('Error en seed:', errC.message);
            else console.log('Datos restaurados exitosamente.');
          });
        });
      } else {
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
    }
  });
});

module.exports = app;
