import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';

export default function Asignacion() {
  const [asesoras, setAsesoras] = useState([]);
  const [texto, setTexto] = useState('');
  const [parseados, setParseados] = useState([]);
  const [importando, setImportando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [cargado, setCargado] = useState(false);
  const fileRef = useRef();

  const [asesoraSeleccionada, setAsesoraSeleccionada] = useState('');
  const [esPrioridad, setEsPrioridad] = useState(false);

  useEffect(() => {
    api.get('/clientes/asesoras/lista').then(({ data }) => setAsesoras(data.asesoras)).catch(() => {});
  }, []);

  const parsearCSV = (contenido) => {
    const lineas = contenido.trim().split('\n').filter(l => l.trim());
    return lineas.map(linea => {
      const cols = linea.split(/[,;\t]/).map(c => c.trim().replace(/^"|"$/g, ''));
      return {
        nombre: cols[0] || '',
        telefono: cols[1] || '',
        direccion: cols[2] || '',
        barrio: cols[3] || '',
        ciudad: cols[4] || 'Medellin',
        ultimoServicio: cols[5] || '',
        observaciones: cols[6] || '',
      };
    }).filter(c => c.nombre);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const contenido = ev.target.result;
      const lista = parsearCSV(contenido);
      setParseados(lista);
      setCargado(true);
      setMensaje('');
    };
    reader.readAsText(file, 'utf-8');
  };

  const handlePegarTexto = () => {
    const lista = parsearCSV(texto);
    setParseados(lista);
    setCargado(true);
    setMensaje('');
  };

  const handleImportar = async () => {
    if (parseados.length === 0) { setMensaje('No hay clientes para importar'); return; }
    setImportando(true);
    setMensaje('');
    try {
      const payload = {
        clientes: parseados,
        prioridad: esPrioridad,
      };
      if (asesoraSeleccionada) {
        payload.asesora_id = asesoraSeleccionada;
      }

      const { data } = await api.post('/clientes/importar', payload);

      const destino = asesoraSeleccionada
        ? asesoras.find(a => String(a.id) === String(asesoraSeleccionada))?.nombre || 'asesora seleccionada'
        : `${asesoras.length} asesoras (equitativo)`;

      setMensaje(`OK ${data.importados} clientes importados y asignados a ${destino}.${esPrioridad ? ' Marcados como PRIORIDAD.' : ''}`);
      setParseados([]);
      setCargado(false);
      setTexto('');
      setEsPrioridad(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al importar');
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Asignacion de Base de Datos</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Carga e importa clientes. Elige una asesora especifica o distribuye equitativamente.
        </p>
      </div>

      {/* Assignment options */}
      <div className="card space-y-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
          Configuracion de Asignacion
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Asignar a</label>
            <select className="input-field" value={asesoraSeleccionada}
              onChange={e => setAsesoraSeleccionada(e.target.value)}>
              <option value="">Todas — distribuir equitativamente</option>
              {asesoras.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className={`relative w-11 h-6 rounded-full transition-colors ${esPrioridad ? 'bg-amber-500' : 'bg-slate-200'}`}
                onClick={() => setEsPrioridad(p => !p)}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${esPrioridad ? 'translate-x-5' : ''}`} />
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">Prioridad</span>
                <p className="text-[10px] text-slate-400">{esPrioridad ? 'Apareceran de primeros en la cola' : 'Posicion normal en cola'}</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-5 py-4">
        <h3 className="text-sm font-semibold text-emerald-800 mb-2">Formato del archivo</h3>
        <p className="text-xs text-slate-500 mb-2">Columnas esperadas (separadas por coma, punto y coma o tabulacion):</p>
        <code className="text-xs bg-white border border-slate-200 rounded-md px-3 py-2 block text-emerald-700 font-mono">
          Nombre, Telefono, Direccion, Barrio, Ciudad, Ultimo Servicio, Observaciones
        </code>
        <p className="text-xs text-slate-400 mt-2">El encabezado es opcional. Los registros sin nombre seran ignorados.</p>
      </div>

      {/* File upload */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Opcion 1: Cargar archivo CSV o TXT</h2>
        <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${cargado && parseados.length ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
          <input type="file" accept=".csv,.txt" ref={fileRef} className="hidden" id="archivo-bd" onChange={handleFile} />
          <label htmlFor="archivo-bd" className="cursor-pointer">
            <svg className="w-9 h-9 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            <p className="text-slate-600 text-sm font-medium">Haz clic para seleccionar archivo</p>
            <p className="text-slate-400 text-xs mt-1">CSV o TXT, max. 50,000 registros</p>
          </label>
        </div>
      </div>

      {/* Paste text */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Opcion 2: Pegar datos directamente</h2>
        <textarea
          className="input-field min-h-[140px] resize-none font-mono text-xs"
          placeholder={"Juan Garcia, 3001234567, Cra 45 #10-20, Laureles, Medellin, 2026-05-15, Cambio de bimetalico\nMaria Lopez, 3109876543, Cl 30 #5-15, Envigado, Envigado, 2026-06-01, Mantenimiento preventivo"}
          value={texto}
          onChange={e => setTexto(e.target.value)}
        />
        <button onClick={handlePegarTexto} className="btn-secondary mt-3">Analizar Datos</button>
      </div>

      {/* Preview */}
      {cargado && parseados.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Vista previa &mdash; {parseados.length} registro(s)
            </h2>
            <div className="flex items-center gap-2">
              {esPrioridad && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">Prioridad</span>
              )}
              <span className="badge badge-blue">
                {asesoraSeleccionada
                  ? asesoras.find(a => String(a.id) === String(asesoraSeleccionada))?.nombre
                  : `${asesoras.length} asesoras`}
              </span>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin space-y-1.5 mb-4">
            {parseados.slice(0, 100).map((c, i) => (
              <div key={i} className="flex flex-col gap-1 bg-slate-50 rounded-md px-4 py-2.5 text-xs border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 w-6 text-right flex-shrink-0 font-semibold">{i + 1}</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[180px]">{c.nombre}</span>
                  <span className="text-emerald-700 font-medium">{c.telefono}</span>
                  <span className="text-slate-500 truncate max-w-[200px]">{c.direccion} ({c.barrio})</span>
                  <span className="text-slate-400 ml-auto font-medium">{c.ciudad}</span>
                </div>
                {(c.ultimoServicio || c.observaciones) && (
                  <div className="pl-9 mt-1 flex flex-col gap-0.5 border-l-2 border-emerald-200 bg-emerald-50/50 py-1 pr-2 rounded-r">
                    {c.ultimoServicio && (
                      <p className="text-[11px] text-emerald-700">
                        <span className="font-semibold text-slate-500">Ultimo Servicio:</span> {c.ultimoServicio}
                      </p>
                    )}
                    {c.observaciones && (
                      <p className="text-[11px] text-slate-600 italic">
                        <span className="font-semibold text-slate-500 not-italic">Obs:</span> &ldquo;{c.observaciones}&rdquo;
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {parseados.length > 100 && (
              <p className="text-center text-xs text-slate-400 py-2">... y {parseados.length - 100} mas</p>
            )}
          </div>

          {mensaje && (
            <div className={`rounded-lg px-4 py-3 text-sm mb-4 ${
              mensaje.startsWith('OK') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {mensaje}
            </div>
          )}

          <button
            id="btn-importar-clientes"
            onClick={handleImportar}
            disabled={importando}
            className="btn-primary"
          >
            {importando ? 'Importando...' : `Importar ${parseados.length} Clientes`}
          </button>
        </div>
      )}

      {/* Out-of-preview messages */}
      {mensaje && !cargado && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          mensaje.startsWith('OK') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {mensaje}
        </div>
      )}
    </div>
  );
}
