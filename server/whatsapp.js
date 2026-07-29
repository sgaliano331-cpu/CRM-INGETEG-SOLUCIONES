const https = require('https');

const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '1140616715811080';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

const NUMERO_PRUEBA = process.env.WHATSAPP_TEST_NUMBER || null;

const TECNICOS_WHATSAPP = {
  'HERNAN': '573043548999',
  'HERNAN HERRERA': '573043548999',
  'FREDY': '573006961589',
  'FREDY CASTAÑEDA': '573006961589',
  'OMAR': '573044974337',
  'OMAR HERRERA': '573044974337',
  'SANCHEZ': '573013602393',
  'ANDRES SANCHEZ': '573013602393',
};

function getNumeroTecnico(nombre) {
  if (!nombre) return null;
  if (NUMERO_PRUEBA) return NUMERO_PRUEBA;
  const key = nombre.toUpperCase().trim();
  return TECNICOS_WHATSAPP[key] || TECNICOS_WHATSAPP[key.split(' ')[0]] || null;
}

function enviarMensajeWhatsApp(telefono, mensaje) {
  return new Promise((resolve, reject) => {
    if (!WHATSAPP_TOKEN) {
      return reject(new Error('WHATSAPP_TOKEN no configurado'));
    }

    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      to: telefono,
      type: 'text',
      text: { body: mensaje },
    });

    const options = {
      hostname: 'graph.facebook.com',
      path: `/v21.0/${WHATSAPP_PHONE_ID}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(new Error(`Respuesta invalida: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function formatearRuta(tecnico, servicios) {
  const fecha = servicios[0]?.fecha_agendamiento || 'mañana';
  let msg = `🛠️ *RUTA ${tecnico} — ${fecha}*\n`;
  msg += `📋 ${servicios.length} servicio(s)\n\n`;

  servicios.forEach((s, i) => {
    msg += `*${i + 1}. ${s.cliente_nombre}*\n`;
    msg += `   📍 ${s.direccion || 'Sin dirección'}`;
    if (s.barrio) msg += `, ${s.barrio}`;
    if (s.ciudad) msg += ` — ${s.ciudad}`;
    msg += '\n';
    if (s.telefono) msg += `   📞 ${s.telefono}\n`;
    msg += `   🔧 ${s.tipo_servicio} — ${s.equipos}\n`;
    if (s.hora_inicio) {
      msg += `   🕐 ${s.hora_inicio}`;
      if (s.hora_fin) msg += ` a ${s.hora_fin}`;
      msg += '\n';
    }
    if (s.costo_cop > 0) msg += `   💰 $${Number(s.costo_cop).toLocaleString('es-CO')} COP\n`;
    msg += '\n';
  });

  msg += '✅ ¡Buena jornada!';
  return msg;
}

module.exports = { enviarMensajeWhatsApp, formatearRuta, getNumeroTecnico, TECNICOS_WHATSAPP };
