const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'ingeteg_crm_secret_2024';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token requerido' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
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

module.exports = { authMiddleware, soloCoordinador, gestorOCoordinador, JWT_SECRET };
