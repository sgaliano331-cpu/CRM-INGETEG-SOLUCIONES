const { google } = require('googleapis');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'soporteingeteg@gmail.com';

let calendarClient = null;

function getCalendar() {
  if (calendarClient) return calendarClient;

  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) {
    console.warn('[Google Calendar] GOOGLE_SERVICE_ACCOUNT_JSON no configurada — eventos deshabilitados');
    return null;
  }

  try {
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

async function crearEventoAgendamiento({ clienteNombre, clienteDireccion, clienteBarrio, clienteCiudad, clienteTelefono, equipos, tipoServicio, fecha, horaInicio, horaFin, costoCop, observaciones, tecnico }) {
  const calendar = getCalendar();
  if (!calendar) return null;

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
      calendarId: CALENDAR_ID,
      requestBody: event,
    });
    console.log(`[Google Calendar] Evento creado: ${result.data.id}`);
    return result.data.id;
  } catch (err) {
    console.error('[Google Calendar] Error al crear evento:', err.message);
    return null;
  }
}

function sumarHoras(hora, horas) {
  const [h, m] = hora.split(':').map(Number);
  const nueva = h + horas;
  return `${String(Math.min(nueva, 23)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

module.exports = { crearEventoAgendamiento };
