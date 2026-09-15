const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev_secret_cambiar_en_produccion');
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET no está configurado en las variables de entorno');
  process.exit(1);
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader ? authHeader.split(' ')[1] : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.jti) {
      const { rows } = await pool.query(
        'SELECT id FROM active_sessions WHERE token_jti = $1 AND revoked_at IS NULL AND expires_at > NOW()',
        [decoded.jti]
      );
      if (rows.length === 0) {
        return res.status(401).json({ error: 'Sesión expirada o cerrada' });
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function soloCoordinador(req, res, next) {
  if (req.user?.rol !== 'COORDINADOR') {
    return res.status(403).json({ error: 'Acceso denegado: solo para Coordinador' });
  }
  next();
}

function gestorOCoordinador(req, res, next) {
  if (req.user?.rol !== 'GESTOR' && req.user?.rol !== 'COORDINADOR') {
    return res.status(403).json({ error: 'Acceso denegado: solo para Gestor o Coordinador' });
  }
  next();
}

function coordOWhatsapp(req, res, next) {
  if (req.user?.rol === 'COORDINADOR' || req.user?.username === 'ygiraldo') {
    return next();
  }
  return res.status(403).json({ error: 'Acceso denegado' });
}

module.exports = { authMiddleware, soloCoordinador, gestorOCoordinador, coordOWhatsapp, JWT_SECRET };
