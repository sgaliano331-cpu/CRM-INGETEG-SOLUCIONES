const { google } = require('googleapis');

const CALENDARIOS_TECNICOS = {
  'HERNAN HERRERA': 'ae47a6b59b357e8a8e800d1ff852277d4bb5563bbd6979df5c7983f8c6855e45@group.calendar.google.com',
  'HERNAN': 'ae47a6b59b357e8a8e800d1ff852277d4bb5563bbd6979df5c7983f8c6855e45@group.calendar.google.com',
  'FREDY CASTAÑEDA': '11f8a2529dc139b31e4663bdfed65536dbd42c6754a5d72e19594ce7512a34a3@group.calendar.google.com',
  'FREDY': '11f8a2529dc139b31e4663bdfed65536dbd42c6754a5d72e19594ce7512a34a3@group.calendar.google.com',
  'OMAR HERRERA': '2a4c1f86d9b21889e979a7444754d8c4c5ec4977f342a766e1689f1c3a56910e@group.calendar.google.com',
  'OMAR': '2a4c1f86d9b21889e979a7444754d8c4c5ec4977f342a766e1689f1c3a56910e@group.calendar.google.com',
  'ANDRES SANCHEZ': '8117d5b14cc385415fcd125bd8890e45b81f442c70506e59d1a0625f734c734b@group.calendar.google.com',
  'SANCHEZ': '8117d5b14cc385415fcd125bd8890e45b81f442c70506e59d1a0625f734c734b@group.calendar.google.com',
};

let calendarClient = null;

function getCalendar() {
  if (calendarClient) return calendarClient;

  const credRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credRaw) {
    console.warn('[Google Calendar] GOOGLE_SERVICE_ACCOUNT_JSON no configurada — eventos deshabilitados');
    return null;
  }

  try {
    const credJson = credRaw.startsWith('ey') ? Buffer.from(credRaw, 'base64').toString('utf8') : credRaw;
    const creds = JSON.parse(credJson);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    calendarClient = google.calendar({ version: 'v3', auth });
    console.log('[Google Calendar] Conectado exitosamente');
    return calendarClient;
  } catch (err) {
    console.error('[Google Calendar] Error al inicializar:', err.message);
    return null;
  }
}

function getCalendarId(tecnico) {
  if (!tecnico) return null;
  const key = tecnico.toUpperCase().trim();
  return CALENDARIOS_TECNICOS[key] || null;
}

async function crearEventoAgendamiento({ clienteNombre, clienteDireccion, clienteBarrio, clienteCiudad, clienteTelefono, equipos, tipoServicio, fecha, horaInicio, horaFin, costoCop, observaciones, tecnico }) {
  const calendar = getCalendar();
  if (!calendar) return null;

  const calendarId = getCalendarId(tecnico);
  if (!calendarId) {
    console.warn(`[Google Calendar] No se creó evento: técnico "${tecnico}" no tiene calendario asignado`);
    return null;
  }

  const titulo = `${tipoServicio} — ${clienteNombre}`;

  const partes = [];
  if (equipos) partes.push(`Equipos: ${equipos}`);
  if (clienteDireccion) partes.push(`Dirección: ${clienteDireccion}`);
  if (clienteBarrio) partes.push(`Barrio: ${clienteBarrio}`);
  if (clienteCiudad) partes.push(`Ciudad: ${clienteCiudad}`);
  if (clienteTelefono) partes.push(`Teléfono: ${clienteTelefono}`);
  if (costoCop) partes.push(`Costo: $${Number(costoCop).toLocaleString('es-CO')} COP`);
  if (observaciones) partes.push(`Observaciones: ${observaciones}`);
  if (tecnico) partes.push(`Técnico: ${tecnico}`);
  const descripcion = partes.join('\n');

  const ubicacion = [clienteDireccion, clienteBarrio, clienteCiudad].filter(Boolean).join(', ');

  let event;

  if (horaInicio) {
    const startDateTime = `${fecha}T${horaInicio.padStart(5, '0')}:00`;
    const endTime = horaFin || sumarHoras(horaInicio, 2);
    const endDateTime = `${fecha}T${endTime.padStart(5, '0')}:00`;

    event = {
      summary: titulo,
      description: descripcion,
      location: ubicacion || undefined,
      start: { dateTime: startDateTime, timeZone: 'America/Bogota' },
      end: { dateTime: endDateTime, timeZone: 'America/Bogota' },
      colorId: '9',
    };
  } else {
    event = {
      summary: titulo,
      description: descripcion,
      location: ubicacion || undefined,
      start: { date: fecha },
      end: { date: fecha },
      colorId: '9',
    };
  }

  try {
    const result = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    console.log(`[Google Calendar] Evento creado en calendario de ${tecnico}: ${result.data.id}`);
    return result.data.id;
  } catch (err) {
    console.error(`[Google Calendar] Error al crear evento para ${tecnico}:`, err.message);
    return null;
  }
}

function sumarHoras(hora, horas) {
  const [h, m] = hora.split(':').map(Number);
  const nueva = h + horas;
  return `${String(Math.min(nueva, 23)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

module.exports = { crearEventoAgendamiento };
