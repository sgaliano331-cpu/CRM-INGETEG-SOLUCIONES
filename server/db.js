const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'ingeteg_crm.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    // 1. Abrimos la conexión e inmediatamente inyectamos los parámetros de mitigación de bloqueo
    db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        console.error('Error crítico al abrir la base de datos:', err.message);
      } else {
        console.log('Conexión nativa establecida con ingeteg_crm.db');
      }
    });

    // 2. BLINDAJE ULTRA: Obligamos a SQLite a esperar hasta 10 segundos en operaciones simultáneas
    db.configure("busyTimeout", 10000);

    // 3. Activamos el modo WAL (Write-Ahead Logging)
    // Esto permite que las asesoras LEAN datos al mismo tiempo que otras ESCRIBEN sin bloquearse.
    db.run('PRAGMA journal_mode = WAL;');
    db.run('PRAGMA foreign_keys = ON;');

    // 4. Inicializar el esquema de forma segura y una sola vez
    try {
      if (fs.existsSync(SCHEMA_PATH)) {
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(schema, (errExec) => {
          if (errExec) {
            console.error('Aviso de Schema (Ya existente o error):', errExec.message);
          } else {
            console.log('Tablas del esquema verificadas correctamente.');
          }
        });
      }
    } catch (error) {
      console.error('Error al verificar el archivo schema.sql:', error.message);
    }

    // 5. Migraciones incrementales
    db.run("ALTER TABLE clientes ADD COLUMN prioridad INTEGER NOT NULL DEFAULT 0", (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error en migración prioridad:', err.message);
      }
    });
    db.run("ALTER TABLE agendamientos ADD COLUMN observaciones_tecnica TEXT", (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error en migración observaciones_tecnica:', err.message);
      }
    });
    db.run("ALTER TABLE agendamientos ADD COLUMN id_servicio TEXT", (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error en migración id_servicio:', err.message);
      }
    });
    db.run("ALTER TABLE agendamientos ADD COLUMN tecnico TEXT", (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error en migración tecnico:', err.message);
      }
    });
    db.run("ALTER TABLE agendamientos ADD COLUMN fecha_atencion TEXT", (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error en migración fecha_atencion:', err.message);
      }
    });

    db.serialize(() => {
      db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='usuarios'", (err, row) => {
        if (err || !row) return;
        if (row.sql.includes("'GESTOR'")) return;
        db.run("PRAGMA writable_schema = ON");
        db.run(`UPDATE sqlite_master SET sql = REPLACE(sql,
          'CHECK(rol IN (''COORDINADOR'',''ASESORA''))',
          'CHECK(rol IN (''COORDINADOR'',''ASESORA'',''GESTOR''))')
          WHERE type='table' AND name='usuarios'`);
        db.run(`UPDATE sqlite_master SET sql = REPLACE(sql,
          'CHECK(rol IN (''COORDINADOR'', ''ASESORA''))',
          'CHECK(rol IN (''COORDINADOR'', ''ASESORA'', ''GESTOR''))')
          WHERE type='table' AND name='usuarios'`);
        db.run("PRAGMA writable_schema = OFF");
        db.run("PRAGMA integrity_check", (errI) => {
          if (errI) console.error('Integrity check warning:', errI.message);
        });
        console.log('Migración: CHECK constraint de usuarios actualizado para incluir GESTOR');
      });
    });

    db.run(`CREATE TABLE IF NOT EXISTS cotizaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agendamiento_id INTEGER NOT NULL REFERENCES agendamientos(id),
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      asesora_id INTEGER NOT NULL REFERENCES usuarios(id),
      gestor_id INTEGER NOT NULL REFERENCES usuarios(id),
      valor_cotizacion REAL NOT NULL DEFAULT 0,
      observacion_gestor TEXT,
      observacion_asesora TEXT,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','agendado','piensa','rechazado')),
      llamado INTEGER NOT NULL DEFAULT 0,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    )`, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creando tabla cotizaciones:', err.message);
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS descansos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('Almuerzo','Desayuno','Pausa Activa')),
      salida TEXT NOT NULL,
      entrada TEXT,
      duracion_minutos REAL,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    )`, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creando tabla descansos:', err.message);
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS llamadas_reprogramadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      agendamiento_id INTEGER REFERENCES agendamientos(id),
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      fecha_reprogramacion TEXT NOT NULL,
      hora_reprogramacion TEXT NOT NULL,
      motivo TEXT,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','completada')),
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    )`, (err) => {
      if (err && !err.message.includes('already exists')) {
        console.error('Error creando tabla llamadas_reprogramadas:', err.message);
      }
    });
  }
  return db;
}

module.exports = { getDb };