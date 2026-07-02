import { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api/axios';

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

export default function Marcacion() {
  const [cliente, setCliente] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [sinClientes, setSinClientes] = useState(false);
  const [errorServidor, setErrorServidor] = useState(false);
  const [historialId, setHistorialId] = useState(null);
  const [inicioLlamada, setInicioLlamada] = useState(null);

  const [form, setForm] = useState({ nombre: '', telefono: '', direccion: '', barrio: '', ciudad: 'Medellin' });
  const [obs, setObs] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [agenda, setAgenda] = useState(emptyAgenda);
  const [reprogramar, setReprogramar] = useState(false);
  const [repFecha, setRepFecha] = useState('');
  const [repHora, setRepHora] = useState('');
  const [repMotivo, setRepMotivo] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargarSiguiente = useCallback(async () => {
    setCargando(true);
    setMensaje('');
    setErrorServidor(false);
    try {
      const { data } = await api.get('/clientes/siguiente');
      if (!data.cliente) {
        setSinClientes(true);
        setCliente(null);
        return;
      }
      setSinClientes(false);
      setCliente(data.cliente);
      setForm({
        nombre: data.cliente.nombre || '',
        telefono: data.cliente.telefono || '',
        direccion: data.cliente.direccion || '',
        barrio: data.cliente.barrio || '',
        ciudad: data.cliente.ciudad || 'Medellin',
      });
      setObs('');
      setAcepto(false);
      setAgenda(emptyAgenda);
      setReprogramar(false);
      setRepFecha('');
      setRepHora('');
      setRepMotivo('');
      setMotivoRechazo('');

      const now = new Date().toISOString();
      setInicioLlamada(now);
      const { data: d2 } = await api.post('/llamadas/iniciar', { cliente_id: data.cliente.id });
      setHistorialId(d2.historial_id);
    } catch (err) {
      console.error("Error cargando cliente:", err);
      setErrorServidor(true);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarSiguiente(); }, [cargarSiguiente]);

  const toggleEquipo = (eq) => {
    setAgenda(a => ({
      ...a,
      equipos: a.equipos.includes(eq)
        ? a.equipos.filter(e => e !== eq)
        : [...a.equipos, eq],
    }));
  };

  const handleReprogramar = async () => {
    if (!repFecha || !repHora) { setMensaje('Fecha y hora de reprogramacion son obligatorias.'); return; }
    const obsFinal = obs.trim() || repMotivo.trim() || 'Llamada reprogramada';

    setGuardando(true);
    try {
      let hId = historialId;
      if (!hId) {
        const { data: d } = await api.post('/llamadas/iniciar', { cliente_id: cliente.id });
        hId = d.historial_id;
        setHistorialId(hId);
        if (!inicioLlamada) setInicioLlamada(new Date().toISOString());
      }
      await api.put(`/clientes/${cliente.id}`, form);
      await api.post('/llamadas/guardar', {
        historial_id: hId,
        cliente_id: cliente.id,
        observaciones: obsFinal,
        acepto_servicio: false,
        inicio_llamada: inicioLlamada,
      });
      await api.post('/llamadas/reprogramar', {
        cliente_id: cliente.id,
        fecha_reprogramacion: repFecha,
        hora_reprogramacion: repHora,
        motivo: repMotivo.trim() || obs.trim(),
      });
      setMensaje('OK. Llamada reprogramada. Cargando siguiente...');
      setTimeout(cargarSiguiente, 1200);
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al reprogramar');
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardar = async () => {
    if (!cliente) { setMensaje('No hay un cliente valido para guardar.'); return; }
    if (!obs.trim()) { setMensaje('Las observaciones son obligatorias.'); return; }
    if (obs.trim().length < 10) { setMensaje('Las observaciones deben tener minimo 10 caracteres.'); return; }
    if (!acepto && !reprogramar && !motivoRechazo) { setMensaje('Selecciona el motivo por el cual no se agenda.'); return; }
    if (acepto && agenda.equipos.length === 0) { setMensaje('Selecciona al menos un equipo para el agendamiento.'); return; }
    if (acepto && !agenda.fecha_agendamiento) { setMensaje('La fecha de agendamiento es requerida.'); return; }

    setGuardando(true);
    try {
      let hId = historialId;
      if (!hId) {
        const { data: d } = await api.post('/llamadas/iniciar', { cliente_id: cliente.id });
        hId = d.historial_id;
        setHistorialId(hId);
        if (!inicioLlamada) setInicioLlamada(new Date().toISOString());
      }

      await api.put(`/clientes/${cliente.id}`, form);

      const obsFinal = !acepto && !reprogramar && motivoRechazo
        ? `[${motivoRechazo}] ${obs}`
        : obs;

      await api.post('/llamadas/guardar', {
        historial_id: hId,
        cliente_id: cliente.id,
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

      setMensaje('OK. Guardado correctamente. Cargando siguiente...');
      setTimeout(cargarSiguiente, 1200);
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg className="animate-spin w-7 h-7 text-emerald-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-slate-500 text-sm">Cargando cliente...</p>
        </div>
      </div>
    );
  }

  if (errorServidor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center card max-w-sm w-full">
          <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-2">Error de Conexion</h3>
          <p className="text-slate-500 text-sm mb-4">El servidor respondio con un error (500). Verifica que el Backend este corriendo.</p>
          <button onClick={cargarSiguiente} className="btn-primary text-xs">
            Reintentar Conexion
          </button>
        </div>
      </div>
    );
  }

  if (sinClientes || !cliente) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center card max-w-sm w-full">
          <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-2">Cola vacia</h3>
          <p className="text-slate-500 text-sm">No tienes clientes asignados en cola en este momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Modulo de Marcacion</h1>
          <p className="text-slate-500 text-sm mt-0.5">Atendiendo cliente en cola</p>
        </div>
        {inicioLlamada && (
          <div className="bg-white px-4 py-2 flex items-center gap-2 rounded-lg border border-slate-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-slate-500">Tiempo:</span>
            <Timer startTime={new Date(inicioLlamada).getTime()} />
          </div>
        )}
      </div>

      {/* Client Card */}
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold">
            {form.nombre?.[0] || '?'}
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-medium">Cliente en cola</p>
            <p className="font-semibold text-slate-800">{form.nombre || 'Sin Nombre'}</p>
          </div>
          <span className="ml-auto bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-semibold">
            ID #{cliente?.id || 'N/A'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Nombre Completo</label>
            <input className="input-field" value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Telefono</label>
            <input className="input-field" value={form.telefono}
              onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Direccion</label>
            <input className="input-field" value={form.direccion}
              onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Barrio</label>
            <input className="input-field" value={form.barrio}
              onChange={e => setForm(f => ({ ...f, barrio: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Ciudad</label>
            <select className="input-field" value={form.ciudad}
              onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}>
              <option>Medellin</option>
              <option>Bello</option>
              <option>Itagui</option>
              <option>Envigado</option>
              <option>Sabaneta</option>
              <option>La Estrella</option>
              <option>Caldas</option>
              <option>Copacabana</option>
              <option>Girardota</option>
              <option>Barbosa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Call Management */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Gestion de Llamada</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Observaciones de la llamada <span className="text-red-500">*</span></label>
            <textarea
              className="input-field min-h-[100px] resize-none"
              placeholder="Describe el resultado de la llamada..."
              value={obs}
              onChange={e => setObs(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acepto}
                onChange={() => { setAcepto(a => !a); setReprogramar(false); setMotivoRechazo(''); }}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700 font-medium">Acepto agendar servicio?</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={reprogramar}
                onChange={() => { setReprogramar(r => !r); setAcepto(false); setMotivoRechazo(''); }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 font-medium">Reprogramar llamada?</span>
            </label>
          </div>

          {!acepto && !reprogramar && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Motivo por el cual no se agenda <span className="text-red-500">*</span></label>
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
        </div>
      </div>

      {/* Scheduling */}
      {acepto && (
        <div className="card border-emerald-200">
          <h2 className="text-sm font-semibold text-emerald-700 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            Detalles del Agendamiento
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Tipo de Equipo(s) <span className="text-red-500">*</span></label>
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
        </div>
      )}

      {/* Reprogramar */}
      {reprogramar && (
        <div className="card border-blue-200">
          <h2 className="text-sm font-semibold text-blue-700 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Reprogramar Llamada
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha de proxima llamada <span className="text-red-500">*</span></label>
              <input type="date" className="input-field" value={repFecha}
                onChange={e => setRepFecha(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Hora de llamada <span className="text-red-500">*</span></label>
              <input type="time" className="input-field" value={repHora}
                onChange={e => setRepHora(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Motivo de reprogramacion</label>
              <textarea className="input-field min-h-[60px] resize-none"
                placeholder="Por que se reprograma esta llamada..."
                value={repMotivo} onChange={e => setRepMotivo(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {mensaje && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          mensaje.startsWith('OK')
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {mensaje}
        </div>
      )}

      {/* Action */}
      <div className="flex justify-end pb-4">
        <button
          id="btn-guardar-siguiente"
          onClick={reprogramar ? handleReprogramar : handleGuardar}
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
  );
}
