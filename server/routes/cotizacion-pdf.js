const express = require('express');
const router = express.Router();
const { authMiddleware, soloCoordinador } = require('../middleware/auth');
const { pool } = require('../db');

router.use(authMiddleware, soloCoordinador);

// POST /api/cotizacion-pdf/generar — Genera PDF cotización para cliente
router.post('/generar', async (req, res) => {
  const { id_instalacion, cliente_nombre, telefono, fecha, items } = req.body;

  if (!cliente_nombre || !items || items.length === 0) {
    return res.status(400).json({ error: 'Nombre del cliente e items son requeridos' });
  }

  try {
    const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const PW = 612, PH = 792, M = 72, CW = PW - M * 2;
    let page = doc.addPage([PW, PH]);
    let y = PH - M;

    const GREEN = rgb(0.106, 0.42, 0.224);
    const TEXT_COLOR = rgb(0.102, 0.118, 0.102);
    const TEXT_SEC = rgb(0.353, 0.38, 0.345);
    const BORDER = rgb(0.831, 0.839, 0.816);
    const SURFACE = rgb(0.969, 0.973, 0.965);
    const HIGHLIGHT = rgb(0.831, 0.627, 0.09);
    const HIGHLIGHT_BG = rgb(0.992, 0.973, 0.91);
    const WHITE = rgb(1, 1, 1);

    const fmt = (n) => '$ ' + Number(n).toLocaleString('es-CO');

    const embedImg = async (src) => {
      try {
        const r = await fetch(src);
        if (!r.ok) return null;
        const bytes = Buffer.from(await r.arrayBuffer());
        try { return await doc.embedJpg(bytes); } catch { return await doc.embedPng(bytes); }
      } catch { return null; }
    };

    // --- HEADER ---
    const logoImg = await embedImg('https://sgaliano331-cpu.github.io/landing-ingeteg/logo-ingeteg.png');
    if (logoImg) {
      const lScale = Math.min(120 / logoImg.width, 40 / logoImg.height, 1);
      const lw = logoImg.width * lScale;
      const lh = logoImg.height * lScale;
      page.drawImage(logoImg, { x: M, y: y - lh + 5, width: lw, height: lh });
    }

    // Right side
    page.drawText('Cotizacion', { x: PW - M - fontBold.widthOfTextAtSize('Cotizacion', 11), y: y - 5, size: 11, font, color: TEXT_COLOR });

    const numText = `No. ${id_instalacion || '—'}`;
    page.drawText(numText, { x: PW - M - fontBold.widthOfTextAtSize(numText, 16), y: y - 25, size: 16, font: fontBold, color: GREEN });

    const fechaText = fecha || new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    page.drawText(fechaText, { x: PW - M - font.widthOfTextAtSize(fechaText, 9), y: y - 40, size: 9, font, color: TEXT_SEC });

    // Green bar
    y -= 55;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 2.5, color: GREEN });

    // NIT
    y -= 15;
    page.drawText('NIT: 901.641.504  |  Mantenimiento y reparacion de electrodomesticos  |  Medellin, Colombia', {
      x: M, y, size: 7, font, color: TEXT_SEC,
    });

    // Separator
    y -= 12;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.5, color: BORDER });

    // --- CLIENT INFO ---
    y -= 18;
    page.drawText('INFORMACION DEL CLIENTE', { x: M, y, size: 8, font: fontBold, color: GREEN });

    const clientFields = [
      ['Nombre', cliente_nombre],
      ['Telefono', telefono || '—'],
      ['ID Instalacion', id_instalacion || '—'],
    ];

    y -= 18;
    for (const [label, value] of clientFields) {
      page.drawText(label, { x: M, y, size: 9, font, color: TEXT_SEC });
      page.drawText(value, { x: M + 115, y, size: 9, font, color: TEXT_COLOR });
      y -= 15;
    }

    // Separator
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.5, color: BORDER });

    // --- DETAIL TABLE ---
    y -= 18;
    page.drawText('DETALLE DE LA COTIZACION', { x: M, y, size: 8, font: fontBold, color: GREEN });

    // Table header
    y -= 22;
    const col1 = M;
    const col2 = M + 115;
    const col3 = PW - M - 85;
    const col4 = PW - M;

    page.drawText('CONCEPTO', { x: col1, y, size: 7.5, font: fontBold, color: TEXT_SEC });
    page.drawText('DESCRIPCION', { x: col2, y, size: 7.5, font: fontBold, color: TEXT_SEC });
    const cantW = fontBold.widthOfTextAtSize('CANT.', 7.5);
    page.drawText('CANT.', { x: col3 + 28 - cantW, y, size: 7.5, font: fontBold, color: TEXT_SEC });
    const valW = fontBold.widthOfTextAtSize('VALOR', 7.5);
    page.drawText('VALOR', { x: col4 - valW, y, size: 7.5, font: fontBold, color: TEXT_SEC });

    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1.2, color: BORDER });

    // Rows
    let totalGeneral = 0;
    for (const item of items) {
      const valor = parseFloat(item.valor) || 0;
      totalGeneral += valor;

      y -= 18;
      page.drawText(item.concepto || '', { x: col1, y, size: 9, font: fontBold, color: TEXT_COLOR });
      if (item.subtitulo) {
        page.drawText(item.subtitulo, { x: col1, y: y - 12, size: 8, font, color: TEXT_SEC });
      }

      const descLines = wrapText(item.descripcion || '', col3 - col2 - 20, 9, font);
      descLines.forEach((line, i) => {
        page.drawText(line, { x: col2, y: y - i * 12, size: 9, font, color: TEXT_COLOR });
      });

      const cantText = String(item.cantidad || 1);
      const cantTw = font.widthOfTextAtSize(cantText, 9);
      page.drawText(cantText, { x: col3 + 28 - cantTw, y, size: 9, font, color: TEXT_COLOR });

      const valText = fmt(valor);
      const valTw = font.widthOfTextAtSize(valText, 9);
      page.drawText(valText, { x: col4 - valTw, y, size: 9, font, color: TEXT_COLOR });

      y -= Math.max(28, descLines.length * 12 + 10);
      page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.5, color: BORDER });
    }

    // --- TOTALS ---
    y -= 22;
    const totLeft = PW - M - 200;
    const totRight = PW - M;

    for (const item of items) {
      const valor = parseFloat(item.valor) || 0;
      page.drawText(item.concepto || '', { x: totLeft, y, size: 9, font, color: TEXT_SEC });
      const vt = fmt(valor);
      page.drawText(vt, { x: totRight - font.widthOfTextAtSize(vt, 9), y, size: 9, font, color: TEXT_SEC });
      y -= 15;
    }

    y -= 5;
    page.drawLine({ start: { x: totLeft, y }, end: { x: totRight, y }, thickness: 2, color: GREEN });

    y -= 18;
    page.drawText('TOTAL', { x: totLeft, y, size: 13, font: fontBold, color: GREEN });
    const totalText = fmt(totalGeneral) + ' COP';
    page.drawText(totalText, { x: totRight - fontBold.widthOfTextAtSize(totalText, 13), y, size: 13, font: fontBold, color: GREEN });

    // --- VALIDITY NOTE ---
    y -= 35;
    const boxH = 30;
    page.drawRectangle({ x: M, y: y - 3, width: CW, height: boxH, color: HIGHLIGHT_BG });
    page.drawRectangle({ x: M, y: y - 3, width: 3, height: boxH, color: HIGHLIGHT });
    page.drawText('Esta cotizacion tiene una vigencia de 15 dias calendario a partir de la fecha de emision.', {
      x: M + 12, y: y + 13, size: 8, font, color: TEXT_SEC,
    });
    page.drawText('Precios sujetos a disponibilidad.', {
      x: M + 12, y: y + 1, size: 8, font, color: TEXT_SEC,
    });

    // --- FOOTER ---
    const footY = 60;
    page.drawRectangle({ x: 0, y: 0, width: PW, height: footY + 15, color: SURFACE });
    page.drawLine({ start: { x: 0, y: footY + 15 }, end: { x: PW, y: footY + 15 }, thickness: 0.5, color: BORDER });

    page.drawText('INGETEG Soluciones', { x: M, y: footY, size: 8, font: fontBold, color: TEXT_COLOR });
    page.drawText('Medellin, Colombia', { x: M, y: footY - 12, size: 7.5, font, color: TEXT_SEC });
    page.drawText('NIT: 901.641.504', { x: M, y: footY - 24, size: 7.5, font, color: TEXT_SEC });

    const contactoW = fontBold.widthOfTextAtSize('Contacto', 8);
    page.drawText('Contacto', { x: PW - M - contactoW, y: footY, size: 8, font: fontBold, color: TEXT_COLOR });
    const emailW = font.widthOfTextAtSize('info@ingeteg.com', 7.5);
    page.drawText('info@ingeteg.com', { x: PW - M - emailW, y: footY - 12, size: 7.5, font, color: TEXT_SEC });
    const webW = font.widthOfTextAtSize('ingeteg.com', 7.5);
    page.drawText('ingeteg.com', { x: PW - M - webW, y: footY - 24, size: 7.5, font, color: TEXT_SEC });

    const watermark = 'Documento generado por INGETEG CRM';
    const wmW = font.widthOfTextAtSize(watermark, 6);
    page.drawText(watermark, { x: (PW - wmW) / 2, y: 20, size: 6, font, color: rgb(0.69, 0.71, 0.68) });

    const pdfBytes = await doc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Cotizacion_${id_instalacion || 'nueva'}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Error generando cotizacion PDF:', err);
    res.status(500).json({ error: 'Error generando PDF' });
  }
});

// GET /api/cotizacion-pdf/historial — Lista cotizaciones generadas
router.get('/historial', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM cotizaciones_pdf
      ORDER BY created_at DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// POST /api/cotizacion-pdf/guardar — Guarda cotización en historial
router.post('/guardar', async (req, res) => {
  const { id_instalacion, cliente_nombre, telefono, fecha, items, total } = req.body;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cotizaciones_pdf (
        id SERIAL PRIMARY KEY,
        id_instalacion TEXT,
        cliente_nombre TEXT NOT NULL,
        telefono TEXT,
        fecha TEXT,
        items JSONB,
        total NUMERIC,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(
      `INSERT INTO cotizaciones_pdf (id_instalacion, cliente_nombre, telefono, fecha, items, total)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id_instalacion, cliente_nombre, telefono, fecha, JSON.stringify(items), parseFloat(total) || 0]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function wrapText(str, maxW, sz, f) {
  const words = String(str || '').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (f.widthOfTextAtSize(test, sz) > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

module.exports = router;
