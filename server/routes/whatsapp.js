const express = require('express');
const router = express.Router();
const { authMiddleware, soloCoordinador } = require('../middleware/auth');
const { pool } = require('../db');

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'ingeteg_whatsapp_verify_2026';
const WA_TOKEN = process.env.WA_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_ID;

// GET /api/whatsapp/webhook — Verificación de Meta
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verificado');
    return res.status(200).send(challenge);
  }
  res.status(403).send('Forbidden');
});

// POST /api/whatsapp/webhook — Recibir mensajes entrantes
router.post('/webhook', async (req, res) => {
  res.status(200).send('OK');

  try {
    const body = req.body;
    if (!body.object || body.object !== 'whatsapp_business_account') return;

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const contact = contacts[i] || {};
          const from = msg.from;
          const name = contact.profile?.name || from;
          const text = msg.text?.body || msg.type || '';
          const msgType = msg.type || 'text';
          const waMessageId = msg.id;

          await pool.query(
            `INSERT INTO whatsapp_mensajes (wa_message_id, telefono, nombre_contacto, mensaje, tipo_mensaje, direccion, estado)
             VALUES ($1, $2, $3, $4, $5, 'entrante', 'nuevo')
             ON CONFLICT (wa_message_id) DO NOTHING`,
            [waMessageId, from, name, text, msgType]
          );
          console.log(`[WhatsApp] Mensaje de ${name} (${from}): ${text}`);
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Error procesando webhook:', err.message);
  }
});

// POST /api/whatsapp/enviar — Enviar mensaje individual
router.post('/enviar', authMiddleware, soloCoordinador, async (req, res) => {
  const { telefono, mensaje, plantilla, plantilla_params, idioma } = req.body;

  if (!WA_TOKEN || !WA_PHONE_ID) {
    return res.status(500).json({ error: 'WhatsApp no configurado. Faltan WA_TOKEN o WA_PHONE_ID.' });
  }

  const phone = telefono.replace(/\D/g, '');
  const fullPhone = phone.startsWith('57') ? phone : '57' + phone;

  try {
    let body;
    if (plantilla) {
      body = {
        messaging_product: 'whatsapp',
        to: fullPhone,
        type: 'template',
        template: {
          name: plantilla,
          language: { code: idioma || 'es_CO' },
          components: plantilla_params || [],
        },
      };
    } else {
      body = {
        messaging_product: 'whatsapp',
        to: fullPhone,
        type: 'text',
        text: { body: mensaje },
      };
    }

    console.log('[WhatsApp] Enviando:', JSON.stringify(body, null, 2));

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    console.log('[WhatsApp] Respuesta:', JSON.stringify(data));

    if (!response.ok) {
      const errMsg = data.error?.message || 'Error al enviar';
      const errDetail = data.error?.error_data?.details || '';
      return res.status(400).json({ error: errDetail ? `${errMsg} — ${errDetail}` : errMsg, detalle: data });
    }

    const waId = data.messages?.[0]?.id;
    await pool.query(
      `INSERT INTO whatsapp_mensajes (wa_message_id, telefono, nombre_contacto, mensaje, tipo_mensaje, direccion, estado)
       VALUES ($1, $2, '', $3, 'text', 'saliente', 'enviado')`,
      [waId, fullPhone, plantilla ? `[Plantilla: ${plantilla}]` : mensaje]
    );

    res.json({ ok: true, message_id: waId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/enviar-masivo — Envío masivo con plantilla
router.post('/enviar-masivo', authMiddleware, soloCoordinador, async (req, res) => {
  const { contactos, telefonos, plantilla, plantilla_params, idioma, headerComponents } = req.body;

  if (!WA_TOKEN || !WA_PHONE_ID) {
    return res.status(500).json({ error: 'WhatsApp no configurado' });
  }
  if (!plantilla) {
    return res.status(400).json({ error: 'Se requiere una plantilla para envío masivo' });
  }

  const langCode = idioma || 'es_CO';
  const resultados = { enviados: 0, fallidos: 0, errores: [] };

  const lista = contactos || (telefonos || []).map(t => ({ telefono: t, params: [] }));
  if (lista.length === 0) {
    return res.status(400).json({ error: 'No hay contactos para enviar' });
  }

  for (const contacto of lista) {
    const phone = String(contacto.telefono).replace(/\D/g, '');
    const fullPhone = phone.startsWith('57') ? phone : '57' + phone;

    try {
      const components = [];
      if (headerComponents && headerComponents.length > 0) {
        components.push(...headerComponents);
      }
      const params = contacto.params || [];
      if (params.length > 0) {
        const filtered = params.filter(v => {
          const val = typeof v === 'object' ? v.value : v;
          return String(val).trim();
        });
        if (filtered.length > 0) {
          components.push({
            type: 'body',
            parameters: filtered.map(v => {
              if (typeof v === 'object' && v.name) {
                return { type: 'text', parameter_name: v.name, text: String(v.value) };
              }
              return { type: 'text', text: String(v) };
            }),
          });
        }
      } else if (plantilla_params && plantilla_params.length > 0) {
        components.push(...plantilla_params);
      }

      const body = {
        messaging_product: 'whatsapp',
        to: fullPhone,
        type: 'template',
        template: {
          name: plantilla,
          language: { code: langCode },
          components,
        },
      };

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${WA_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (response.ok) {
        resultados.enviados++;
        const waId = data.messages?.[0]?.id;
        await pool.query(
          `INSERT INTO whatsapp_mensajes (wa_message_id, telefono, nombre_contacto, mensaje, tipo_mensaje, direccion, estado)
           VALUES ($1, $2, '', $3, 'template', 'saliente', 'enviado')`,
          [waId, fullPhone, `[Masivo - Plantilla: ${plantilla}]`]
        );
      } else {
        resultados.fallidos++;
        resultados.errores.push({ telefono: fullPhone, error: data.error?.message });
      }

      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      resultados.fallidos++;
      resultados.errores.push({ telefono: fullPhone, error: err.message });
    }
  }

  res.json(resultados);
});

// GET /api/whatsapp/mensajes — Historial de mensajes
router.get('/mensajes', authMiddleware, soloCoordinador, async (req, res) => {
  const { telefono, limit } = req.query;
  try {
    let query, params;
    if (telefono) {
      query = 'SELECT * FROM whatsapp_mensajes WHERE telefono = $1 ORDER BY creado_en DESC LIMIT $2';
      params = [telefono, parseInt(limit) || 50];
    } else {
      query = `SELECT DISTINCT ON (telefono) * FROM whatsapp_mensajes ORDER BY telefono, creado_en DESC LIMIT $1`;
      params = [parseInt(limit) || 50];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/conversaciones — Lista de conversaciones (inbox)
router.get('/conversaciones', authMiddleware, soloCoordinador, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT telefono, nombre_contacto,
        MAX(creado_en) as ultimo_mensaje,
        (SELECT mensaje FROM whatsapp_mensajes m2 WHERE m2.telefono = m1.telefono ORDER BY creado_en DESC LIMIT 1) as ultimo_texto,
        (SELECT direccion FROM whatsapp_mensajes m3 WHERE m3.telefono = m1.telefono ORDER BY creado_en DESC LIMIT 1) as ultima_direccion,
        COUNT(*) FILTER (WHERE estado = 'nuevo' AND direccion = 'entrante') as no_leidos
      FROM whatsapp_mensajes m1
      GROUP BY telefono, nombre_contacto
      ORDER BY MAX(creado_en) DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/whatsapp/marcar-leido/:telefono — Marcar como leído
router.put('/marcar-leido/:telefono', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      "UPDATE whatsapp_mensajes SET estado = 'leido' WHERE telefono = $1 AND estado = 'nuevo'",
      [req.params.telefono]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/plantillas — Listar plantillas de Meta
router.get('/plantillas', authMiddleware, soloCoordinador, async (req, res) => {
  const WABA_ID = process.env.WA_WABA_ID || '1045301044658851';
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?limit=100`,
      { headers: { Authorization: `Bearer ${WA_TOKEN}` } }
    );
    const data = await response.json();
    if (!response.ok) {
      return res.status(400).json({ error: data.error?.message, detalle: data });
    }
    const templates = (data.data || []).map(t => ({
      name: t.name,
      status: t.status,
      language: t.language,
      category: t.category,
      components: t.components,
    }));
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
