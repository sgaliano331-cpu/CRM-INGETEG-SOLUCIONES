import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const EQUIPOS = [
  'Cubierta', 'Estufas', 'Calentador', 'Horno', 'Campana Extractora',
  'Lavadora', 'Nevera', 'Aire Acondicionado', 'Redes de Gas (Reparacion)',
  'Redes de Gas (Mantenimiento)',
];
const TIPOS_SERVICIO = ['Mantenimiento', 'Reparación', 'Garantía'];
const MOTIVOS_RECHAZO = [
  'No le interesa',
  'No tiene dinero',
  'Ya lo realiza con otra empresa',
  'Tiene una mala experiencia',
  'Número fuera de servicio',
  'No contesta',
  'Usuario se comunica',
  'Se esta gestionando por WhatsApp',
  'Número equivocado',
  'Ya realizo el servicio con Ingeteg',
];

function Timer({ startTime }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [startTime]);

  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  return (
    <span className={`font-mono text-sm font-semibold ${elapsed > 180 ? 'text-amber-600' : 'text-emerald-600'}`}>
      {m}:{s}
    </span>
  );
}

const emptyAgenda = {
  equipos: [],
  tipo_servicio: 'Mantenimiento',
  fecha_agendamiento: '',
  costo_cop: '',
};

export default function LlamadasReprogramadas() {
  const { isCoordinador } = useAuth();

  const [reprogramadas, setReprogramadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [asesoras, setAsesoras] = useState([]);
  const [filtroAsesora, setFiltroAsesora] = useState('');

  // Call modal state
  const [llamandoA, setLlamandoA] = useState(null);
  const [historialId, setHistorialId] = useState(null);
  const [inicioLlamada, setInicioLlamada] = useState(null);
  const [obs, setObs] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [agenda, setAgenda] = useState(emptyAgenda);
  const [reReprogramar, setReReprogramar] = useState(false);
  const [repFecha, setRepFecha] = useState('');
  const [repHora, setRepHora] = useState('');
  const [repMotivo, setRepMotivo] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargarReprogramadas = async () => {
    setCargando(true);
    try {
      const { data } = await api.get('/llamadas/reprogramadas');
      setReprogramadas(data.reprogramadas || []);
    } catch (err) {
      console.error('Error cargando reprogramadas:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarReprogramadas();
    if (isCoordinador) {
      api.get('/clientes/asesoras/lista')
        .then(({ data }) => setAsesoras(data.asesoras || []))
        .catch(() => {});
    }
  }, [isCoordinador]);

  const resetCallState = () => {
    setLlamandoA(null);
    setHistorialId(null);
    setInicioLlamada(null);
    setObs('');
    setAcepto(false);
    setAgenda(emptyAgenda);
    setReReprogramar(false);
    setRepFecha('');
    setRepHora('');
    setRepMotivo('');
    setMotivoRechazo('');
    setGuardando(false);
    setMensaje('');
  };

  const iniciarLlamada = async (repro) => {
    resetCallState();
    setLlamandoA(repro);
    setMensaje('');
    try {
      const now = new Date().toISOString();
      setInicioLlamada(now);
      const { data } = await api.post('/llamadas/iniciar', { cliente_id: repro.cliente_id });
      setHistorialId(data.historial_id);
    } catch (err) {
      console.error('Error iniciando llamada:', err);
      setMensaje('Error al iniciar la llamada');
    }
  };

  const toggleEquipo = (eq) => {
    setAgenda(a => ({
      ...a,
      equipos: a.equipos.includes(eq)
        ? a.equipos.filter(e => e !== eq)
        : [...a.equipos, eq],
    }));
  };

  const handleReReprogramar = async () => {
    if (!llamandoA) return;
    if (!repFecha || !repHora) { setMensaje('Fecha y hora son obligatorias.'); return; }
    const obsFinal = obs.trim() || repMotivo.trim() || 'Llamada reprogramada';
    setGuardando(true);
    try {
      let hId = historialId;
      if (!hId) {
        const { data: d } = await api.post('/llamadas/iniciar', { cliente_id: llamandoA.cliente_id });
        hId = d.historial_id;
        setHistorialId(hId);
        if (!inicioLlamada) setInicioLlamada(new Date().toISOString());
      }
      await api.post('/llamadas/guardar', {
        historial_id: hId,
        cliente_id: llamandoA.cliente_id,
        observaciones: obsFinal,
        acepto_servicio: false,
        inicio_llamada: inicioLlamada,
      });
      await api.put(`/llamadas/reprogramada/${llamandoA.id}/completar`);
      await api.post('/llamadas/reprogramar', {
        cliente_id: llamandoA.cliente_id,
        agendamiento_id: llamandoA.agendamiento_id || null,
        fecha_reprogramacion: repFecha,
        hora_reprogramacion: repHora,
        motivo: repMotivo.trim() || obsFinal,
      });
      setMensaje('OK. Llamada reprogramada nuevamente.');
      resetCallState();
      cargarReprogramadas();
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al reprogramar');
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardar = async () => {
    if (!llamandoA) return;
    if (!obs.trim()) { setMensaje('Las observaciones son obligatorias.'); return; }
    if (acepto && agenda.equipos.length === 0) { setMensaje('Selecciona al menos un equipo para el agendamiento.'); return; }
    if (acepto && !agenda.fecha_agendamiento) { setMensaje('La fecha de agendamiento es requerida.'); return; }
    if (!acepto && !reReprogramar && !motivoRechazo) { setMensaje('Selecciona el motivo por el cual no se agenda.'); return; }

    const obsFinal = !acepto && !reReprogramar && motivoRechazo
      ? `[${motivoRechazo}] ${obs}`
      : obs;

    setGuardando(true);
    try {
      let hId = historialId;
      if (!hId) {
        const { data: d } = await api.post('/llamadas/iniciar', { cliente_id: llamandoA.cliente_id });
        hId = d.historial_id;
        setHistorialId(hId);
        if (!inicioLlamada) setInicioLlamada(new Date().toISOString());
      }

      await api.post('/llamadas/guardar', {
        historial_id: hId,
        cliente_id: llamandoA.cliente_id,
        observaciones: obsFinal,
        acepto_servicio: acepto,
        inicio_llamada: inicioLlamada,
        ...(acepto && {
          equipos: agenda.equipos.join(', '),
          tipo_servicio: agenda.tipo_servicio,
          fecha_agendamiento: agenda.fecha_agendamiento,
          costo_cop: parseFloat(agenda.costo_cop) || 0,
        }),
      });

      await api.put(`/llamadas/reprogramada/${llamandoA.id}/completar`);

      setMensaje('OK. Llamada guardada correctamente.');
      resetCallState();
      cargarReprogramadas();
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar la llamada');
    } finally {
      setGuardando(false);
    }
  };

  const filtradas = filtroAsesora
    ? reprogramadas.filter(r => String(r.usuario_id) === filtroAsesora)
    : reprogramadas;

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="animate-spin w-7 h-7 text-emerald-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-slate-500 text-sm">Cargando llamadas reprogramadas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Llamadas Reprogramadas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Llamadas programadas para seguimiento</p>
        </div>
        <span className="badge badge-blue">{filtradas.length} pendiente{filtradas.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Coordinator filter */}
      {isCoordinador && asesoras.length > 0 && (
        <div className="card">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Filtrar por Asesora</label>
          <select
            className="input-field"
            value={filtroAsesora}
            onChange={e => setFiltroAsesora(e.target.value)}
          >
            <option value="">Todas las asesoras</option>
            {asesoras.map(a => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {/* Global message */}
      {mensaje && !llamandoA && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          mensaje.startsWith('OK')
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {mensaje}
        </div>
      )}

      {/* Empty state */}
      {filtradas.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center card max-w-sm w-full">
            <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-2">Sin pendientes</h3>
            <p className="text-slate-500 text-sm">No hay llamadas reprogramadas pendientes</p>
          </div>
        </div>
      )}

      {/* Reprogramadas list */}
      {filtradas.map(repro => (
        <div key={repro.id} className="card">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold">
                {repro.nombre?.[0] || '?'}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{repro.nombre || 'Sin Nombre'}</p>
                <p className="text-xs text-slate-500">{repro.telefono || 'Sin telefono'}</p>
              </div>
            </div>
            <span className="badge badge-yellow text-xs">Reprogramada</span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
            {repro.direccion && (
              <div>
                <span className="text-slate-400 text-xs">Direccion:</span>
                <p className="text-slate-700">{repro.direccion}</p>
              </div>
            )}
            <div>
              <span className="text-slate-400 text-xs">Fecha programada:</span>
              <p className="text-slate-700">
                {repro.fecha_reprogramacion || 'N/A'}
                {repro.hora_reprogramacion ? ` - ${repro.hora_reprogramacion}` : ''}
              </p>
            </div>
            {repro.motivo && (
              <div className="col-span-2">
                <span className="text-slate-400 text-xs">Motivo:</span>
                <p className="text-slate-700">{repro.motivo}</p>
              </div>
            )}
          </div>

          {/* Agendamiento info if exists */}
          {repro.equipos && (
            <div className="bg-slate-50 rounded-lg p-3 mb-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Agendamiento previo</p>
              <div className="flex flex-wrap gap-1.5 mb-1">
                {repro.equipos.split(', ').map(eq => (
                  <span key={eq} className="badge badge-blue text-xs">{eq}</span>
                ))}
              </div>
              <div className="flex gap-4 text-xs text-slate-600 mt-1">
                {repro.tipo_servicio && <span>Tipo: <strong>{repro.tipo_servicio}</strong></span>}
                {repro.estado_servicio && <span>Estado: <strong>{repro.estado_servicio}</strong></span>}
              </div>
            </div>
          )}

          {/* Coordinator: show asesora */}
          {isCoordinador && repro.asesora_nombre && (
            <p className="text-xs text-slate-500 mb-3">
              Asesora: <span className="font-semibold text-slate-700">{repro.asesora_nombre}</span>
            </p>
          )}

          {/* Call button or inline form */}
          {llamandoA?.id === repro.id ? (
            <div className="border-t border-slate-200 pt-4 mt-3 space-y-4">
              {/* Timer */}
              {inicioLlamada && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-slate-500">En llamada:</span>
                  <Timer startTime={new Date(inicioLlamada).getTime()} />
                </div>
              )}

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Observaciones de la llamada <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input-field min-h-[100px] resize-none"
                  placeholder="Describe el resultado de la llamada..."
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                />
              </div>

              {/* Checkboxes */}
              <div className="flex gap-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acepto}
                    onChange={() => { setAcepto(a => !a); setReReprogramar(false); }}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700 font-medium">Acepto agendar servicio?</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={reReprogramar}
                    onChange={() => { setReReprogramar(r => !r); setAcepto(false); }}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 font-medium">Reprogramar llamada?</span>
                </label>
              </div>

              {/* Motivos de objecion */}
              {!acepto && !reReprogramar && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Motivo por el cual no se agenda <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MOTIVOS_RECHAZO.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMotivoRechazo(motivoRechazo === m ? '' : m)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                          motivoRechazo === m
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Agenda details */}
              {acepto && (
                <div className="border border-emerald-200 rounded-lg p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    Detalles del Agendamiento
                  </h3>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      Tipo de Equipo(s) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {EQUIPOS.map(eq => (
                        <button
                          key={eq}
                          type="button"
                          onClick={() => toggleEquipo(eq)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all
                            ${agenda.equipos.includes(eq)
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                        >
                          {eq}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Tipo de Servicio</label>
                      <select className="input-field" value={agenda.tipo_servicio}
                        onChange={e => setAgenda(a => ({ ...a, tipo_servicio: e.target.value }))}>
                        {TIPOS_SERVICIO.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha de Agendamiento</label>
                      <input type="date" className="input-field" value={agenda.fecha_agendamiento}
                        onChange={e => setAgenda(a => ({ ...a, fecha_agendamiento: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Costo del Servicio (COP)</label>
                      <input type="number" className="input-field" placeholder="0"
                        value={agenda.costo_cop}
                        onChange={e => setAgenda(a => ({ ...a, costo_cop: e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}

              {/* Reprogramar form */}
              {reReprogramar && (
                <div className="border border-blue-200 rounded-lg p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Reprogramar Llamada
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha <span className="text-red-500">*</span></label>
                      <input type="date" className="input-field" value={repFecha}
                        onChange={e => setRepFecha(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Hora <span className="text-red-500">*</span></label>
                      <input type="time" className="input-field" value={repHora}
                        onChange={e => setRepHora(e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Motivo</label>
                      <textarea className="input-field min-h-[60px] resize-none"
                        placeholder="Por que se reprograma esta llamada..."
                        value={repMotivo} onChange={e => setRepMotivo(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Inline message */}
              {mensaje && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                  mensaje.startsWith('OK')
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {mensaje}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={resetCallState}
                  className="btn-secondary text-xs px-4 py-2"
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  onClick={reReprogramar ? handleReReprogramar : handleGuardar}
                  disabled={guardando}
                  className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5"
                >
                  {guardando ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    <>
                      Guardar y Siguiente
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end mt-2">
              <button
                onClick={() => iniciarLlamada(repro)}
                disabled={llamandoA !== null}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
                Llamar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
