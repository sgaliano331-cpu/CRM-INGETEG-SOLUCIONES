const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, soloCoordinador } = require('../middleware/auth');
const { pool } = require('../db');

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'ingeteg_whatsapp_verify_2026';
const WA_TOKEN = process.env.WA_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_ID;

const uploadsDir = path.join(__dirname, '..', 'uploads', 'whatsapp');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')),
  }),
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp|mp4|mp3|ogg|m4a|aac|amr|opus|pdf|doc|docx|xls|xlsx)$/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  },
});

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
          const msgType = msg.type || 'text';
          const waMessageId = msg.id;

          let text = msg.text?.body || '';
          let mediaUrl = null;

          // Handle media messages
          const mediaTypes = ['audio', 'image', 'video', 'document', 'sticker'];
          if (mediaTypes.includes(msgType) && msg[msgType]?.id) {
            const mediaId = msg[msgType].id;
            text = msg[msgType]?.caption || msgType;
            try {
              // Get media URL from WhatsApp
              const mediaResp = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
                headers: { Authorization: `Bearer ${WA_TOKEN}` },
              });
              const mediaData = await mediaResp.json();
              if (mediaData.url) {
                // Download the media file
                const fileResp = await fetch(mediaData.url, {
                  headers: { Authorization: `Bearer ${WA_TOKEN}` },
                });
                if (fileResp.ok) {
                  const buffer = Buffer.from(await fileResp.arrayBuffer());
                  const ext = { audio: 'ogg', image: 'jpg', video: 'mp4', document: 'pdf', sticker: 'webp' }[msgType] || 'bin';
                  const mimeType = mediaData.mime_type || '';
                  const realExt = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('webp') ? 'webp' : mimeType.includes('png') ? 'png' : mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : mimeType.includes('pdf') ? 'pdf' : ext;
                  const filename = `${Date.now()}-${waMessageId}.${realExt}`;
                  const mediaDir = path.join(__dirname, '..', 'uploads', 'whatsapp');
                  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
                  fs.writeFileSync(path.join(mediaDir, filename), buffer);
                  mediaUrl = `/uploads/whatsapp/${filename}`;
                  console.log(`[WhatsApp] Media guardado: ${filename} (${mimeType})`);
                }
              }
            } catch (mediaErr) {
              console.error('[WhatsApp] Error descargando media:', mediaErr.message);
            }
          } else if (msgType === 'button') {
            text = msg.button?.text || 'button';
          } else if (msgType === 'interactive') {
            text = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || 'interactive';
          } else if (!text) {
            text = msgType;
          }

          await pool.query(
            `INSERT INTO whatsapp_mensajes (wa_message_id, telefono, nombre_contacto, mensaje, tipo_mensaje, direccion, estado, media_url)
             VALUES ($1, $2, $3, $4, $5, 'entrante', 'nuevo', $6)
             ON CONFLICT (wa_message_id) DO NOTHING`,
            [waMessageId, from, name, text, msgType, mediaUrl]
          );
          console.log(`[WhatsApp] Mensaje de ${name} (${from}): ${text} ${mediaUrl ? '[media]' : ''}`);

          await pool.query(
            `UPDATE whatsapp_campana_contactos SET estado = 'respondio' WHERE telefono = $1 AND estado = 'enviado'`,
            [from]
          );
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Error procesando webhook:', err.message);
  }
});

// POST /api/whatsapp/enviar — Enviar mensaje individual (texto, plantilla o media)
router.post('/enviar', authMiddleware, soloCoordinador, async (req, res) => {
  const { telefono, mensaje, plantilla, plantilla_params, idioma, mediaType, mediaUrl, caption } = req.body;

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
    } else if (mediaType && mediaUrl) {
      const mediaObj = { link: mediaUrl };
      if (caption && mediaType !== 'audio') mediaObj.caption = caption;
      body = {
        messaging_product: 'whatsapp',
        to: fullPhone,
        type: mediaType,
        [mediaType]: mediaObj,
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
    const msgText = plantilla ? `[Plantilla: ${plantilla}]` : mediaType ? (caption || mediaType) : mensaje;
    const msgTipo = mediaType || 'text';
    const localMedia = mediaType ? mediaUrl : null;
    await pool.query(
      `INSERT INTO whatsapp_mensajes (wa_message_id, telefono, nombre_contacto, mensaje, tipo_mensaje, direccion, estado, media_url)
       VALUES ($1, $2, '', $3, $4, 'saliente', 'enviado', $5)`,
      [waId, fullPhone, msgText, msgTipo, localMedia]
    );

    res.json({ ok: true, message_id: waId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/enviar-masivo — Envío masivo con plantilla
router.post('/enviar-masivo', authMiddleware, soloCoordinador, async (req, res) => {
  const { contactos, telefonos, plantilla, plantilla_params, idioma, headerComponents, campana } = req.body;

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
        const campName = campana || plantilla;
        await pool.query(
          `INSERT INTO whatsapp_campana_contactos (campana, plantilla, telefono, estado)
           VALUES ($1, $2, $3, 'enviado')
           ON CONFLICT (campana, telefono) DO NOTHING`,
          [campName, plantilla, fullPhone]
        );

        // Auto-crear cliente si no existe
        try {
          const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
          const getParam = (names) => {
            for (const n of names) {
              const found = params.find(v => v.name && normalize(v.name) === n);
              if (found && String(found.value).trim()) return String(found.value).trim();
            }
            return null;
          };
          const cNombre = getParam(['nombre']) || 'Sin nombre';
          const cDireccion = getParam(['direccion']);
          const cBarrio = getParam(['barrio']);
          const cCiudad = getParam(['municipio', 'ciudad']) || null;
          const localPhone = phone.startsWith('57') ? phone.slice(2) : phone;

          const existe = await pool.query('SELECT id FROM clientes WHERE telefono = $1 OR telefono = $2', [localPhone, fullPhone]);
          if (existe.rows.length === 0) {
            const coord = await pool.query("SELECT id FROM usuarios WHERE rol = 'COORDINADOR' AND activo = 1 LIMIT 1");
            const coordId = coord.rows[0]?.id || req.user.id;
            await pool.query(
              'INSERT INTO clientes (nombre, telefono, direccion, barrio, ciudad, asignado_a) VALUES ($1, $2, $3, $4, $5, $6)',
              [cNombre, localPhone, cDireccion, cBarrio, cCiudad, coordId]
            );
          }
        } catch (clienteErr) {
          console.error('[WhatsApp] Error creando cliente:', clienteErr.message);
        }
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

// GET /api/whatsapp/campanas — Lista de campañas con contadores
router.get('/campanas', authMiddleware, soloCoordinador, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT campana, plantilla, COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'enviado') as enviados,
        COUNT(*) FILTER (WHERE estado = 'respondio') as respondieron,
        MAX(creado_en) as ultima_actividad
      FROM whatsapp_campana_contactos
      GROUP BY campana, plantilla
      ORDER BY MAX(creado_en) DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/conversaciones — Lista de conversaciones (inbox)
router.get('/conversaciones', authMiddleware, soloCoordinador, async (req, res) => {
  const { campana } = req.query;
  try {
    let query, params;
    if (campana) {
      query = `
        SELECT m1.telefono,
          MAX(CASE WHEN m1.nombre_contacto != '' THEN m1.nombre_contacto ELSE NULL END) as nombre_contacto,
          MAX(m1.creado_en) as ultimo_mensaje,
          (SELECT mensaje FROM whatsapp_mensajes m2 WHERE m2.telefono = m1.telefono ORDER BY creado_en DESC LIMIT 1) as ultimo_texto,
          (SELECT direccion FROM whatsapp_mensajes m3 WHERE m3.telefono = m1.telefono ORDER BY creado_en DESC LIMIT 1) as ultima_direccion,
          COUNT(*) FILTER (WHERE m1.estado = 'nuevo' AND m1.direccion = 'entrante') as no_leidos,
          cc.estado as estado_campana
        FROM whatsapp_mensajes m1
        INNER JOIN whatsapp_campana_contactos cc ON cc.telefono = m1.telefono AND cc.campana = $1
        GROUP BY m1.telefono, cc.estado
        ORDER BY (COUNT(*) FILTER (WHERE m1.estado = 'nuevo' AND m1.direccion = 'entrante') > 0) DESC, MAX(m1.creado_en) DESC
        LIMIT 100
      `;
      params = [campana];
    } else {
      query = `
        SELECT telefono,
          MAX(CASE WHEN nombre_contacto != '' THEN nombre_contacto ELSE NULL END) as nombre_contacto,
          MAX(creado_en) as ultimo_mensaje,
          (SELECT mensaje FROM whatsapp_mensajes m2 WHERE m2.telefono = m1.telefono ORDER BY creado_en DESC LIMIT 1) as ultimo_texto,
          (SELECT direccion FROM whatsapp_mensajes m3 WHERE m3.telefono = m1.telefono ORDER BY creado_en DESC LIMIT 1) as ultima_direccion,
          COUNT(*) FILTER (WHERE estado = 'nuevo' AND direccion = 'entrante') as no_leidos
        FROM whatsapp_mensajes m1
        GROUP BY telefono
        ORDER BY (COUNT(*) FILTER (WHERE estado = 'nuevo' AND direccion = 'entrante') > 0) DESC, MAX(creado_en) DESC
        LIMIT 100
      `;
      params = [];
    }
    const { rows } = await pool.query(query, params);
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

// GET /api/whatsapp/contacto/:telefono — Info del contacto
router.get('/contacto/:telefono', authMiddleware, async (req, res) => {
  const tel = req.params.telefono;
  try {
    let { rows } = await pool.query('SELECT * FROM whatsapp_contactos WHERE telefono = $1', [tel]);
    let contacto = rows[0];
    if (!contacto) {
      const nombre = await pool.query(
        "SELECT nombre_contacto FROM whatsapp_mensajes WHERE telefono = $1 AND nombre_contacto != '' ORDER BY creado_en DESC LIMIT 1",
        [tel]
      );
      const campana = await pool.query(
        'SELECT campana FROM whatsapp_campana_contactos WHERE telefono = $1 ORDER BY creado_en DESC LIMIT 1',
        [tel]
      );
      await pool.query(
        'INSERT INTO whatsapp_contactos (telefono, nombre, campana_origen) VALUES ($1, $2, $3) ON CONFLICT (telefono) DO NOTHING',
        [tel, nombre.rows[0]?.nombre_contacto || null, campana.rows[0]?.campana || null]
      );
      const r2 = await pool.query('SELECT * FROM whatsapp_contactos WHERE telefono = $1', [tel]);
      contacto = r2.rows[0];
    }

    const etiquetas = await pool.query(
      'SELECT e.id, e.nombre, e.color FROM whatsapp_contacto_etiquetas ce JOIN whatsapp_etiquetas e ON e.id = ce.etiqueta_id WHERE ce.contacto_telefono = $1',
      [tel]
    );
    const notas = await pool.query(
      'SELECT * FROM whatsapp_notas WHERE contacto_telefono = $1 ORDER BY creado_en DESC LIMIT 50',
      [tel]
    );

    // Buscar datos del cliente en tabla clientes (sin 57 o con 57)
    const localPhone = tel.startsWith('57') ? tel.slice(2) : tel;
    const cliente = await pool.query(
      'SELECT id, nombre, direccion, barrio, ciudad FROM clientes WHERE telefono = $1 OR telefono = $2 LIMIT 1',
      [localPhone, tel]
    );

    res.json({
      ...contacto,
      cliente: cliente.rows[0] || null,
      etiquetas: etiquetas.rows,
      notas: notas.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/whatsapp/contacto/:telefono — Actualizar info del contacto
router.put('/contacto/:telefono', authMiddleware, async (req, res) => {
  const tel = req.params.telefono;
  const { direccion, estado, asesor_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO whatsapp_contactos (telefono) VALUES ($1) ON CONFLICT (telefono) DO NOTHING',
      [tel]
    );
    const sets = [];
    const params = [];
    let idx = 1;
    if (direccion !== undefined) { sets.push(`direccion = $${idx++}`); params.push(direccion); }
    if (estado !== undefined) { sets.push(`estado = $${idx++}`); params.push(estado); }
    if (asesor_id !== undefined) { sets.push(`asesor_id = $${idx++}`); params.push(asesor_id || null); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
    sets.push(`actualizado_en = NOW()`);
    params.push(tel);
    const { rows } = await pool.query(
      `UPDATE whatsapp_contactos SET ${sets.join(', ')} WHERE telefono = $${idx} RETURNING *`,
      params
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/etiquetas — Todas las etiquetas disponibles
router.get('/etiquetas', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM whatsapp_etiquetas ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/etiquetas — Crear nueva etiqueta
router.post('/etiquetas', authMiddleware, async (req, res) => {
  const { nombre, color } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO whatsapp_etiquetas (nombre, color) VALUES ($1, $2) ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING *',
      [nombre.trim(), color || '#6b7280']
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/contacto/:telefono/etiqueta — Agregar etiqueta a contacto
router.post('/contacto/:telefono/etiqueta', authMiddleware, async (req, res) => {
  const tel = req.params.telefono;
  const { etiqueta_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO whatsapp_contacto_etiquetas (contacto_telefono, etiqueta_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [tel, etiqueta_id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/whatsapp/contacto/:telefono/etiqueta/:etiquetaId — Quitar etiqueta
router.delete('/contacto/:telefono/etiqueta/:etiquetaId', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM whatsapp_contacto_etiquetas WHERE contacto_telefono = $1 AND etiqueta_id = $2',
      [req.params.telefono, parseInt(req.params.etiquetaId)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/contacto/:telefono/nota — Agregar nota
router.post('/contacto/:telefono/nota', authMiddleware, async (req, res) => {
  const tel = req.params.telefono;
  const { texto } = req.body;
  if (!texto?.trim()) return res.status(400).json({ error: 'Texto requerido' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO whatsapp_notas (contacto_telefono, texto, usuario_id, usuario_nombre) VALUES ($1, $2, $3, $4) RETURNING *',
      [tel, texto.trim(), req.user.id, req.user.nombre]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/whatsapp/contacto/:telefono/nota/:notaId — Eliminar nota
router.delete('/contacto/:telefono/nota/:notaId', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM whatsapp_notas WHERE id = $1 AND contacto_telefono = $2', [parseInt(req.params.notaId), req.params.telefono]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/asesores — Lista de usuarios para asignar
router.get('/asesores', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nombre, rol FROM usuarios WHERE activo = 1 ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/upload — Subir archivo para header de plantilla
router.post('/upload', authMiddleware, soloCoordinador, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibio archivo' });
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const url = `${protocol}://${host}/uploads/whatsapp/${req.file.filename}`;
  res.json({ ok: true, url, filename: req.file.filename });
});

module.exports = router;
