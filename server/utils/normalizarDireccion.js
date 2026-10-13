'use strict';

const ABREVIACIONES = {
  'CALLE': 'CL', 'CALLLE': 'CL', 'CALL': 'CL', 'CLL': 'CL', 'CL': 'CL',
  'CARRERA': 'CR', 'CARR': 'CR', 'CRA': 'CR', 'CRR': 'CR', 'KR': 'CR', 'CR': 'CR',
  'TRANSVERSAL': 'TV', 'TRANSV': 'TV', 'TRANS': 'TV', 'TRAN': 'TV', 'TRAS': 'TV', 'TRAV': 'TV', 'TR': 'TV', 'TV': 'TV',
  'DIAGONAL': 'DG', 'DIAG': 'DG', 'DG': 'DG',
  'CIRCULAR': 'CIR', 'CIRC': 'CIR', 'CQ': 'CIR', 'CIR': 'CIR',
  'AVENIDA': 'AV', 'AVDA': 'AV', 'AVD': 'AV', 'AV': 'AV',
  'AUTOPISTA': 'AU', 'AU': 'AU',
};

const COMPLEMENTOS = {
  'APARTAMENTO': 'AP', 'APTO': 'AP', 'APT': 'AP', 'AP': 'AP',
  'INTERIOR': 'INT', 'INT': 'INT',
  'CASA': 'CS', 'CS': 'CS',
  'TORRE': 'TO', 'TO': 'TO',
  'BLOQUE': 'BL', 'BQ': 'BL', 'BL': 'BL',
  'PISO': 'PISO', 'PI': 'PISO',
  'LOCAL': 'LC', 'LC': 'LC',
  'OFICINA': 'OF', 'OF': 'OF',
  'MANZANA': 'MZ', 'MZ': 'MZ',
  'LOTE': 'LT', 'LT': 'LT',
};

const ORIENTACIONES = ['SUR', 'NORTE', 'ESTE', 'OESTE'];

function esNumeroTelefono(dir) {
  const soloDigitos = dir.replace(/\D/g, '');
  return soloDigitos.length >= 7 && soloDigitos.length <= 10 && /^\d+$/.test(dir.trim());
}

function esRural(dir) {
  return /^RURAL/i.test(dir.trim());
}

function normalizarDireccion(direccionRaw) {
  if (!direccionRaw || typeof direccionRaw !== 'string') return null;

  let dir = direccionRaw.trim().toUpperCase();

  if (esNumeroTelefono(dir) || esRural(dir)) return null;

  // Detectar si es solo un nombre (sin dígitos) — no es dirección
  if (!/\d/.test(dir)) return null;

  // Quitar puntos de abreviaciones: Cra. → Cra, Dg. → Dg, Cl. → Cl
  dir = dir.replace(/\b(CL|CR|CRA|CRR|CLL|TV|TR|DG|AV|CIR|AU)\./gi, '$1');

  // Separar abreviaciones pegadas a números: CR46 → CR 46, CL75 → CL 75
  dir = dir.replace(/\b(CL|CR|CRA|CRR|CLL|TV|TR|DG|AV|CIR|CQ|AU|CALLE|CARRERA|TRANSVERSAL|DIAGONAL|CIRCULAR|AVENIDA|AVDA|TRANSV|CALLLE|TRAS|TRAV)(\d)/gi, '$1 $2');

  // "CIRCULAR PRIMERA/SEGUNDA/TERCERA/CUARTA" → "CIR 1/2/3/4"
  dir = dir.replace(/\bCIRCULAR\s+(PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA)\b/gi, (_, num) => {
    const map = { PRIMERA: '1', SEGUNDA: '2', TERCERA: '3', CUARTA: '4', QUINTA: '5' };
    return 'CIR ' + map[num.toUpperCase()];
  });

  // Separar números pegados a guión-número: 75SUR-150 → 75 SUR -150
  dir = dir.replace(/(\d)(SUR|NORTE|ESTE|OESTE)/gi, '$1 $2');

  // "NUMERO" al inicio indica que falta el tipo de vía — no se puede normalizar con certeza
  // Pero intentamos: si empieza con NUMERO, quitarlo
  dir = dir.replace(/^\s*NUMERO\s+/i, 'CL ');

  // Quitar ":" al inicio
  dir = dir.replace(/^:/, '');

  // Extraer complemento entre paréntesis para preservarlo
  let complementoParentesis = '';
  dir = dir.replace(/\(([^)]+)\)/g, (_, contenido) => {
    complementoParentesis = contenido.trim();
    return '';
  });

  // Quitar ciudad/barrio pegados con coma: ", Medellín, Belén, ..."
  dir = dir.replace(/,\s*(MEDELL[IÍ]N|BELLO|ENVIGADO|ITAGUI|SABANETA|CALDAS).*$/i, '');

  // Quitar texto descriptivo después de doble guión o palabras clave largas
  dir = dir.replace(/--.*$/, '');
  dir = dir.replace(/\b(URBANIZACION|URB|UNIDAD|BARRIO|CERCA|CONJUNTO|CONJ|SECTOR|EDIFICIO|EDF|EDIF|CONDOMINIO)\b.*$/i, '');

  // Reemplazar # y N° y NUMERO como separador
  dir = dir.replace(/#/g, ' ');
  dir = dir.replace(/\bN[°º]?\b/gi, '');
  dir = dir.replace(/\bNUMERO\b/gi, '');

  // Normalizar espacios
  dir = dir.replace(/\s+/g, ' ').trim();

  // Reemplazar nombres completos de vías por abreviaciones
  const abrevKeys = Object.keys(ABREVIACIONES).sort((a, b) => b.length - a.length);
  for (const nombre of abrevKeys) {
    const regex = new RegExp(`\\b${nombre}\\b`, 'g');
    dir = dir.replace(regex, ABREVIACIONES[nombre]);
  }

  // Normalizar complementos
  const compKeys = Object.keys(COMPLEMENTOS).sort((a, b) => b.length - a.length);
  for (const nombre of compKeys) {
    const regex = new RegExp(`\\b${nombre}\\b`, 'g');
    dir = dir.replace(regex, COMPLEMENTOS[nombre]);
  }

  // Limpiar guiones con espacios: "- " o " -" → "-"
  dir = dir.replace(/\s*-\s*/g, ' -');

  // Extraer complemento (AP, INT, CS, TO, etc.) y todo lo que sigue
  let complementoFinal = '';
  const compAbrevs = [...new Set(Object.values(COMPLEMENTOS))].join('|');
  const compRegex = new RegExp(`\\b(${compAbrevs})\\b.*$`);
  const compMatch = dir.match(compRegex);
  if (compMatch) {
    complementoFinal = compMatch[0].trim();
    dir = dir.substring(0, compMatch.index).trim();
  }

  // Agregar el complemento del paréntesis si existe
  if (complementoParentesis) {
    let cp = complementoParentesis;
    for (const nombre of compKeys) {
      const regex = new RegExp(`\\b${nombre}\\b`, 'g');
      cp = cp.replace(regex, COMPLEMENTOS[nombre]);
    }
    if (!complementoFinal) complementoFinal = cp;
  }

  // Normalizar espacios finales
  dir = dir.replace(/\s+/g, ' ').trim();

  // Limpiar guión suelto al final
  dir = dir.replace(/\s*-\s*$/, '');

  return {
    direccionEPM: dir,
    complemento: complementoFinal || null,
    direccionCompleta: complementoFinal ? `${dir} ${complementoFinal}` : dir,
    original: direccionRaw.trim(),
    valida: tieneFormatoValido(dir),
  };
}

function tieneFormatoValido(dir) {
  // Debe empezar con un tipo de vía conocido seguido de un número
  const tiposVia = [...new Set(Object.values(ABREVIACIONES))].join('|');
  const regex = new RegExp(`^(${tiposVia})\\s+\\d`);
  return regex.test(dir);
}

function detectarCiudadEPM(ciudadCRM) {
  if (!ciudadCRM) return null;
  const ciudad = ciudadCRM.trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  const mapa = {
    'MEDELLIN': { nombre: 'MEDELLIN', codigo: '05001' },
    'BELLO': { nombre: 'BELLO', codigo: '05088' },
    'ITAGUI': { nombre: 'ITAGUI', codigo: '05360' },
    'ENVIGADO': { nombre: 'ENVIGADO', codigo: '05266' },
    'SABANETA': { nombre: 'SABANETA', codigo: '05631' },
    'CALDAS': { nombre: 'CALDAS', codigo: '05129' },
    'LA ESTRELLA': { nombre: 'LA ESTRELLA', codigo: '05380' },
    'COPACABANA': { nombre: 'COPACABANA', codigo: '05212' },
    'GIRARDOTA': { nombre: 'GIRARDOTA', codigo: '05308' },
    'BARBOSA': { nombre: 'BARBOSA', codigo: '05079' },
    'RIONEGRO': { nombre: 'RIONEGRO', codigo: '05615' },
    'MARINILLA': { nombre: 'MARINILLA', codigo: '05440' },
    'GUARNE': { nombre: 'GUARNE', codigo: '05318' },
    'LA CEJA': { nombre: 'LA CEJA', codigo: '05376' },
    'RETIRO': { nombre: 'RETIRO', codigo: '05607' },
    'EL CARMEN DE VIBORAL': { nombre: 'EL CARMEN DE VIBORAL', codigo: '05148' },
  };

  return mapa[ciudad] || null;
}

module.exports = { normalizarDireccion, detectarCiudadEPM, esNumeroTelefono, esRural };
