const { google } = require('googleapis');

const SPREADSHEET_ID = '1CuQ2M94dt3nPLlY8Sqc_gqVt4etJ5-AFSruGq0d582c';
const SHEET_NAME = 'AGENDAS';

let sheetsClient = null;

function getSheets() {
  if (sheetsClient) return sheetsClient;

  const credRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credRaw) {
    console.warn('[Google Sheets] GOOGLE_SERVICE_ACCOUNT_JSON no configurada');
    return null;
  }

  try {
    const credJson = credRaw.startsWith('ey') ? Buffer.from(credRaw, 'base64').toString('utf8') : credRaw;
    const creds = JSON.parse(credJson);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    console.log('[Google Sheets] Conectado exitosamente');
    return sheetsClient;
  } catch (err) {
    console.error('[Google Sheets] Error al inicializar:', err.message);
    return null;
  }
}

async function agregarFilaCertificacion({ asesora, barrio, tipoInmueble, direccion, municipio, nombreUsuario, contacto, cedula, fechaVisita, jornada, tarifa, observacion }) {
  const sheets = getSheets();
  if (!sheets) return null;

  const row = [
    asesora || '',
    barrio || '',
    tipoInmueble || 'RESIDENCIAL',
    direccion || '',
    municipio || '',
    nombreUsuario || '',
    contacto || '',
    cedula || '',
    fechaVisita || '',
    jornada || '',
    tarifa || '',
    observacion || '',
  ];

  try {
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:L`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
    console.log(`[Google Sheets] Fila agregada: ${result.data.updates.updatedRange}`);
    return result.data.updates.updatedRange;
  } catch (err) {
    console.error('[Google Sheets] Error al agregar fila:', err.message);
    return null;
  }
}

module.exports = { agregarFilaCertificacion };
