const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('connect', () => {
  console.log('Conexión establecida con PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function getDb() {
  return {
    get(sql, params, callback) {
      pool.query(convertPlaceholders(sql), params)
        .then(result => callback(null, result.rows[0] || undefined))
        .catch(err => callback(err));
    },
    all(sql, params, callback) {
      pool.query(convertPlaceholders(sql), params)
        .then(result => callback(null, result.rows))
        .catch(err => callback(err));
    },
    run(sql, params, callback) {
      const pgSql = convertPlaceholders(sql);
      const isInsert = /^\s*INSERT/i.test(sql);
      const finalSql = isInsert && !/RETURNING/i.test(pgSql) ? pgSql + ' RETURNING id' : pgSql;

      pool.query(finalSql, params)
        .then(result => {
          const ctx = {
            lastID: isInsert && result.rows[0] ? result.rows[0].id : null,
            changes: result.rowCount,
          };
          if (typeof callback === 'function') callback.call(ctx, null);
        })
        .catch(err => {
          if (typeof callback === 'function') callback.call({}, err);
        });
    },
  };
}

async function getClient() {
  return pool.connect();
}

async function initializeDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  try {
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('Tablas del esquema verificadas correctamente.');
    }
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log('Tablas ya existen, continuando...');
    } else {
      console.error('Error en schema:', err.message);
    }
  }
}

initializeDb();

module.exports = { getDb, getClient, pool };
