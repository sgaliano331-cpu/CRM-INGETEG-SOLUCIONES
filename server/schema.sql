-- =============================================================================
-- SCHEMA SQL - CRM INGETEG SOLUCIONES
-- Compatible con PostgreSQL (producción) y SQLite (desarrollo local)
-- =============================================================================

-- Tabla de Usuarios (Coordinador + Asesoras)
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK(rol IN ('COORDINADOR', 'ASESORA', 'GESTOR')),
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tabla de Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  barrio TEXT,
  ciudad TEXT DEFAULT 'Medellín',
  asignado_a INTEGER REFERENCES usuarios(id),
  posicion_cola INTEGER,
  prioridad INTEGER NOT NULL DEFAULT 0,
  llamado INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tabla de Historial de Llamadas (incluye métricas de tiempo)
CREATE TABLE IF NOT EXISTS historial_llamadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  inicio_llamada TEXT NOT NULL,
  fin_llamada TEXT,
  duracion_segundos INTEGER,
  observaciones TEXT,
  acepto_servicio INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tabla de Agendamientos
CREATE TABLE IF NOT EXISTS agendamientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  historial_id INTEGER NOT NULL REFERENCES historial_llamadas(id),
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  equipos TEXT NOT NULL,
  tipo_servicio TEXT NOT NULL CHECK(tipo_servicio IN ('Mantenimiento','Reparación','Garantía')),
  fecha_agendamiento TEXT NOT NULL,
  costo_cop REAL NOT NULL DEFAULT 0,
  estado_servicio TEXT NOT NULL DEFAULT 'Agendado'
    CHECK(estado_servicio IN ('Agendado','Cumplido','Pendiente por repuesto','Cancelado por el cliente')),
  metodo_pago TEXT
    CHECK(metodo_pago IN ('Efectivo','Pendiente por cobro','Transferencia','Garantía', NULL)),
  observaciones_tecnica TEXT,
  comprobante_pago_url TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tabla de Llamadas Reprogramadas
CREATE TABLE IF NOT EXISTS llamadas_reprogramadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  agendamiento_id INTEGER REFERENCES agendamientos(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  fecha_reprogramacion TEXT NOT NULL,
  hora_reprogramacion TEXT NOT NULL,
  motivo TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','completada')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_clientes_asignado ON clientes(asignado_a);
CREATE INDEX IF NOT EXISTS idx_clientes_llamado ON clientes(llamado);
CREATE INDEX IF NOT EXISTS idx_historial_usuario ON historial_llamadas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_historial_cliente ON historial_llamadas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_agendamientos_cliente ON agendamientos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_agendamientos_fecha ON agendamientos(fecha_agendamiento);
CREATE INDEX IF NOT EXISTS idx_agendamientos_estado ON agendamientos(estado_servicio);
CREATE INDEX IF NOT EXISTS idx_agendamientos_metodo ON agendamientos(metodo_pago);
CREATE INDEX IF NOT EXISTS idx_reprogramadas_usuario ON llamadas_reprogramadas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_reprogramadas_estado ON llamadas_reprogramadas(estado);
