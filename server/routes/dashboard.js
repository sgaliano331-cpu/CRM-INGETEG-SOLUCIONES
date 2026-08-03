const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware, soloCoordinador } = require('../middleware/auth');

// ─── GET /api/dashboard/resumen ───────────────────────────────────────────
router.get('/resumen', authMiddleware, soloCoordinador, (req, res) => {
  const db = getDb();

  // Ejecución en cascada nativa para evitar colisiones
  db.all(`
    SELECT TO_CHAR(creado_en, 'HH24') AS hora, COUNT(*) AS total
    FROM agendamientos
    WHERE creado_en >= NOW() - INTERVAL '30 days'
    GROUP BY hora ORDER BY hora
  `, [], (err, porHora) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(`
      SELECT EXTRACT(DOW FROM creado_en)::text AS dia_semana, COUNT(*) AS total
      FROM agendamientos
      WHERE creado_en >= NOW() - INTERVAL '30 days'
      GROUP BY dia_semana ORDER BY dia_semana
    `, [], (err2, porDia) => {
      if (err2) return res.status(500).json({ error: err2.message });

      db.all(`
        SELECT u.id, u.nombre,
          COUNT(a.id) AS total_agendamientos,
          SUM(a.costo_cop) AS total_cop,
          SUM(CASE WHEN a.estado_servicio != 'Cancelado por el cliente' AND (a.metodo_pago != 'Pendiente por cobro' OR a.comprobante_pago_url IS NOT NULL) THEN a.costo_cop ELSE 0 END) AS ejecutado_cop
        FROM usuarios u
        LEFT JOIN agendamientos a ON a.usuario_id = u.id
        WHERE u.rol = 'ASESORA'
        GROUP BY u.id
      `, [], (err3, porAsesora) => {
        if (err3) return res.status(500).json({ error: err3.message });

        db.all(`
          SELECT a.usuario_id, u.nombre,
            SUM(CASE WHEN a.estado_servicio != 'Cancelado por el cliente' AND (a.metodo_pago != 'Pendiente por cobro' OR a.comprobante_pago_url IS NOT NULL) THEN a.costo_cop ELSE 0 END) AS ejecutado_mes
          FROM agendamientos a
          JOIN usuarios u ON a.usuario_id = u.id
          WHERE TO_CHAR(CASE WHEN a.comprobante_pago_url IS NOT NULL THEN a.actualizado_en ELSE a.creado_en END, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
          GROUP BY a.usuario_id, u.nombre
        `, [], (err4, metasMes) => {
          if (err4) return res.status(500).json({ error: err4.message });

          db.all(`
            SELECT u.id, u.nombre, COUNT(c.id) AS pendientes_llamar
            FROM usuarios u
            LEFT JOIN clientes c ON c.asignado_a = u.id AND c.llamado = 0
            WHERE u.rol = 'ASESORA'
            GROUP BY u.id
          `, [], (err5, enCola) => {
            if (err5) return res.status(500).json({ error: err5.message });

            res.json({ 
              porHora: porHora || [], 
              porDia: porDia || [], 
              porAsesora: porAsesora || [], 
              metasMes: metasMes || [], 
              enCola: enCola || [] 
            });
          });
        });
      });
    });
  });
});

// ─── GET /api/dashboard/auditoria ────────────────────────────────────────
router.get('/auditoria', authMiddleware, soloCoordinador, (req, res) => {
  const db = getDb();
  const { asesora_id, fecha_desde, fecha_hasta } = req.query;

  let where = 'WHERE hl.fin_llamada IS NOT NULL';
  const params = [];

  if (asesora_id) {
    where += ' AND hl.usuario_id = ?';
    params.push(asesora_id);
  }
  if (fecha_desde) {
    where += ' AND hl.creado_en::date >= ?';
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    where += ' AND hl.creado_en::date <= ?';
    params.push(fecha_hasta);
  }

  const queryRegistros = `
    SELECT hl.id, u.nombre AS asesora, c.nombre AS cliente,
      hl.inicio_llamada, hl.fin_llamada, hl.duracion_segundos,
      hl.acepto_servicio, hl.observaciones, hl.creado_en
    FROM historial_llamadas hl
    JOIN usuarios u ON hl.usuario_id = u.id
    JOIN clientes c ON hl.cliente_id = c.id
    ${where}
    ORDER BY hl.creado_en DESC
    LIMIT 500
  `;

  db.all(queryRegistros, params, (err, registros) => {
    if (err) return res.status(500).json({ error: err.message });

    const queryTiempo = `
      SELECT u.nombre AS asesora, u.id AS usuario_id,
        COUNT(hl.id) AS total_llamadas,
        SUM(hl.duracion_segundos) AS tiempo_total_seg,
        AVG(hl.duracion_segundos) AS tiempo_promedio_seg
      FROM historial_llamadas hl
      JOIN usuarios u ON hl.usuario_id = u.id
      ${where}
      GROUP BY u.id, u.nombre
    `;

    db.all(queryTiempo, params, (err2, tiempoTotal) => {
      if (err2) return res.status(500).json({ error: err2.message });

      res.json({ registros: registros || [], tiempoTotal: tiempoTotal || [] });
    });
  });
});

// ─── GET /api/dashboard/metas-asesora ────────────────────────────────────
const META_MENSUAL_BASE = 12000000;
const META_SEMANAL_BASE = 3000000;

router.get('/metas-asesora', authMiddleware, (req, res) => {
  const db = getDb();
  const esCoord = req.user.rol === 'COORDINADOR';

  // El coordinador ve la suma de TODAS las asesoras (monto ejecutado y meta).
  // Una asesora ve solo lo suyo.
  const scope = esCoord
    ? `usuario_id IN (SELECT id FROM usuarios WHERE rol = 'ASESORA')`
    : `usuario_id = ?`;
  const scopeParams = esCoord ? [] : [req.user.id];

  const responder = (numAsesoras) => {
    const metaMensual = META_MENSUAL_BASE * (esCoord ? numAsesoras : 1);
    const metaSemanal = META_SEMANAL_BASE * (esCoord ? numAsesoras : 1);

    const queryMes = `
      SELECT COALESCE(SUM(costo_cop), 0) AS ejecutado
      FROM agendamientos
      WHERE ${scope}
        AND estado_servicio != 'Cancelado por el cliente'
        AND (metodo_pago != 'Pendiente por cobro' OR comprobante_pago_url IS NOT NULL)
        AND TO_CHAR(CASE WHEN comprobante_pago_url IS NOT NULL THEN actualizado_en ELSE creado_en END, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
    `;

    db.get(queryMes, scopeParams, (err, mMes) => {
      if (err) return res.status(500).json({ error: err.message });

      const querySemana = `
        SELECT COALESCE(SUM(costo_cop), 0) AS ejecutado
        FROM agendamientos
        WHERE ${scope}
          AND estado_servicio != 'Cancelado por el cliente'
          AND (metodo_pago != 'Pendiente por cobro' OR comprobante_pago_url IS NOT NULL)
          AND (CASE WHEN comprobante_pago_url IS NOT NULL THEN actualizado_en ELSE creado_en END)::date >= (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::int)
          AND (CASE WHEN comprobante_pago_url IS NOT NULL THEN actualizado_en ELSE creado_en END)::date <= (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::int + 7)
      `;

      db.get(querySemana, scopeParams, (err2, mSem) => {
        if (err2) return res.status(500).json({ error: err2.message });

        res.json({
          metaMensual: { ejecutado: mMes ? mMes.ejecutado : 0, meta: metaMensual },
          metaSemanal: { ejecutado: mSem ? mSem.ejecutado : 0, meta: metaSemanal },
        });
      });
    });
  };

  if (esCoord) {
    db.get(`SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'ASESORA'`, [], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      responder(row ? row.n : 0);
    });
  } else {
    responder(1);
  }
});

// ─── GET /api/dashboard/tecnicos ─────────────────────────────────────────
router.get('/tecnicos', authMiddleware, soloCoordinador, (req, res) => {
  const db = getDb();
  const { fecha_desde, fecha_hasta } = req.query;

  let where = "WHERE a.estado_servicio IN ('Cumplido', 'Visita Fallida', 'Pendiente por repuesto') AND a.tecnico IS NOT NULL";
  const params = [];

  if (fecha_desde) {
    where += ' AND a.fecha_agendamiento >= ?';
    params.push(fecha_desde);
  }
  if (fecha_hasta) {
    where += ' AND a.fecha_agendamiento <= ?';
    params.push(fecha_hasta);
  }

  const query = `
    SELECT
      a.tecnico,
      COUNT(a.id) AS total_servicios,
      SUM(a.costo_cop) AS total_recaudado,
      COALESCE(SUM(rep.total_repuestos), 0) AS total_repuestos_cop,
      COALESCE(SUM(rep.cantidad_repuestos), 0) AS cantidad_repuestos,
      SUM(a.costo_cop) - COALESCE(SUM(rep.total_repuestos), 0) AS total_mano_obra,
      COUNT(DISTINCT a.fecha_agendamiento) AS dias_trabajados,
      ROUND(COUNT(a.id)::numeric / NULLIF(COUNT(DISTINCT a.fecha_agendamiento), 0), 1) AS promedio_por_dia
    FROM agendamientos a
    LEFT JOIN (
      SELECT ru.detalle_id,
        SUM(ru.valor_total) AS total_repuestos,
        SUM(ru.cantidad) AS cantidad_repuestos
      FROM repuestos_usados ru
      GROUP BY ru.detalle_id
    ) rep ON rep.detalle_id = (SELECT dst.id FROM detalle_servicio_tecnico dst WHERE dst.agendamiento_id = a.id LIMIT 1)
    ${where}
    GROUP BY a.tecnico
    ORDER BY total_servicios DESC
  `;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ tecnicos: rows || [] });
  });
});

module.exports = router;