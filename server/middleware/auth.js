const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'ingeteg_crm_jwt_2024_secure';
if (!process.env.JWT_SECRET) {
  console.warn('ADVERTENCIA: JWT_SECRET no está configurado. Usando secreto por defecto. Configurar en variables de entorno para producción.');
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader ? authHeader.split(' ')[1] : req.query?.token || null;
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
