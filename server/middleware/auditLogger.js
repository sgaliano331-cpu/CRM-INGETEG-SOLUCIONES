const { pool } = require('../db');

async function logAudit({ userId, username, action, tableName, recordId, oldValues, newValues, ip }) {
  try {
    await pool.query(
      'INSERT INTO audit_actions (user_id, username, action, table_name, record_id, old_values, new_values, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [userId, username, action, tableName, recordId || null, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null, ip || null]
    );
  } catch (e) {
    console.error('Error en audit log:', e.message);
  }
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
}

module.exports = { logAudit, getClientIp };
