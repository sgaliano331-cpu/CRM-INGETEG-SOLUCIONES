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

app.listen(PORT, async () => {
  console.log(`\nCRM INGETEG Server corriendo en http://localhost:${PORT}`);

  const fs = require('fs');
  const { getClient } = require('./db');

  let client;
  try {
    client = await getClient();
    const { rows } = await client.query('SELECT COUNT(*) as cnt FROM clientes');
    const cnt = parseInt(rows[0].cnt);

    if (cnt === 0) {
      const seedPath = path.join(__dirname, 'seed_data.json');
      if (fs.existsSync(seedPath)) {
        console.log('Base de datos vacia, restaurando datos desde seed_data.json...');
        const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

        await client.query('BEGIN');

        if (data.usuarios) {
          for (const u of data.usuarios) {
            await client.query(
              'INSERT INTO usuarios (id, username, password_hash, nombre, rol, activo, creado_en) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
              [u.id, u.username, u.password_hash, u.nombre, u.rol, u.activo, u.creado_en]
            );
          }
          console.log('Usuarios:', data.usuarios.length);
        }

        if (data.clientes) {
          for (const c of data.clientes) {
            await client.query(
              'INSERT INTO clientes (id, nombre, telefono, direccion, barrio, ciudad, asignado_a, posicion_cola, prioridad, llamado, creado_en, actualizado_en) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING',
              [c.id, c.nombre, c.telefono, c.direccion, c.barrio, c.ciudad, c.asignado_a, c.posicion_cola, c.prioridad, c.llamado, c.creado_en, c.actualizado_en]
            );
          }
          console.log('Clientes:', data.clientes.length);
        }

        if (data.historial_llamadas) {
          for (const h of data.historial_llamadas) {
            await client.query(
              'INSERT INTO historial_llamadas (id, cliente_id, usuario_id, inicio_llamada, fin_llamada, duracion_segundos, observaciones, acepto_servicio, creado_en) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING',
              [h.id, h.cliente_id, h.usuario_id, h.inicio_llamada, h.fin_llamada, h.duracion_segundos, h.observaciones, h.acepto_servicio, h.creado_en]
            );
          }
          console.log('Historial llamadas:', data.historial_llamadas.length);
        }

        if (data.agendamientos) {
          for (const a of data.agendamientos) {
            await client.query(
              'INSERT INTO agendamientos (id, historial_id, cliente_id, usuario_id, equipos, tipo_servicio, fecha_agendamiento, costo_cop, estado_servicio, metodo_pago, observaciones_tecnica, comprobante_pago_url, creado_en, actualizado_en, id_servicio, tecnico, fecha_atencion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT (id) DO NOTHING',
              [a.id, a.historial_id, a.cliente_id, a.usuario_id, a.equipos, a.tipo_servicio, a.fecha_agendamiento, a.costo_cop, a.estado_servicio, a.metodo_pago, a.observaciones_tecnica, a.comprobante_pago_url, a.creado_en, a.actualizado_en, a.id_servicio || null, a.tecnico || null, a.fecha_atencion || null]
            );
          }
          console.log('Agendamientos:', data.agendamientos.length);
        }

        if (data.descansos) {
          for (const d of data.descansos) {
            await client.query(
              'INSERT INTO descansos (id, usuario_id, tipo, salida, entrada, duracion_minutos, creado_en) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
              [d.id, d.usuario_id, d.tipo, d.salida, d.entrada, d.duracion_minutos, d.creado_en]
            );
          }
          console.log('Descansos:', data.descansos.length);
        }

        if (data.cotizaciones) {
          for (const c of data.cotizaciones) {
            await client.query(
              'INSERT INTO cotizaciones (id, agendamiento_id, cliente_id, asesora_id, gestor_id, valor_cotizacion, observacion_gestor, observacion_asesora, estado, llamado, creado_en) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING',
              [c.id, c.agendamiento_id, c.cliente_id, c.asesora_id, c.gestor_id, c.valor_cotizacion, c.observacion_gestor, c.observacion_asesora, c.estado, c.llamado, c.creado_en]
            );
          }
          console.log('Cotizaciones:', data.cotizaciones.length);
        }

        if (data.llamadas_reprogramadas) {
          for (const r of data.llamadas_reprogramadas) {
            await client.query(
              'INSERT INTO llamadas_reprogramadas (id, cliente_id, agendamiento_id, usuario_id, fecha_reprogramacion, hora_reprogramacion, motivo, estado, creado_en) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING',
              [r.id, r.cliente_id, r.agendamiento_id, r.usuario_id, r.fecha_reprogramacion, r.hora_reprogramacion, r.motivo, r.estado, r.creado_en]
            );
          }
          console.log('Reprogramadas:', data.llamadas_reprogramadas.length);
        }

        // Reset sequences to max id
        const tables = ['usuarios', 'clientes', 'historial_llamadas', 'agendamientos', 'cotizaciones', 'descansos', 'llamadas_reprogramadas'];
        for (const t of tables) {
          await client.query(`SELECT setval('${t}_id_seq', COALESCE((SELECT MAX(id) FROM ${t}), 1))`);
        }

        await client.query('COMMIT');
        console.log('Datos restaurados exitosamente.');
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
        for (const u of usuarios) {
          const hash = bcrypt.hashSync(u.password, 10);
          await client.query(
            'INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING',
            [u.username, hash, u.nombre, u.rol]
          );
        }
        console.log('Usuarios creados exitosamente.');
      }
    }
  } catch (err) {
    console.error('Error en seed/init:', err.message);
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) {}
    }
  } finally {
    if (client) client.release();
  }
});

module.exports = app;
