import { useEffect, useState } from 'react';
import api from '../api/axios';

const EQUIPOS = [
  'Cubierta', 'Estufas', 'Calentador', 'Horno', 'Campana Extractora',
  'Lavadora', 'Nevera', 'Aire Acondicionado', 'Redes de Gas (Reparacion)',
  'Redes de Gas (Mantenimiento)',
];
const TIPOS_SERVICIO = ['Mantenimiento', 'Reparación', 'Garantía'];

const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

export default function CotizacionVigente() {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [seleccionado, setSeleccionado] = useState(null);
  const [obsAsesora, setObsAsesora] = useState('');
  const [resultado, setResultado] = useState('');

  const [agEquipos, setAgEquipos] = useState([]);
  const [agTipo, setAgTipo] = useState('Mantenimiento');
  const [agFecha, setAgFecha] = useState('');
  const [agCosto, setAgCosto] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargar = async () => {
    setCargando(true);
    try {
      const { data } = await api.get('/cotizaciones/vigentes');
      setCotizaciones(data.cotizaciones || []);
    } catch { setCotizaciones([]); }
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const seleccionar = (c) => {
    setSeleccionado(c);
    setObsAsesora('');
    setResultado('');
    setAgEquipos([]);
    setAgTipo('Mantenimiento');
    setAgFecha('');
    setAgCosto(String(c.valor_cotizacion || ''));
    setMensaje('');
  };

  const resetForm = () => {
    setSeleccionado(null);
    setResultado('');
    setMensaje('');
  };

  const handleGuardar = async () => {
    if (!resultado) { setMensaje('Selecciona el resultado de la llamada'); return; }
    if (!obsAsesora.trim()) { setMensaje('Las observaciones son obligatorias'); return; }
    if (resultado === 'agendado' && agEquipos.length === 0) { setMensaje('Selecciona al menos un equipo'); return; }
    if (resultado === 'agendado' && !agFecha) { setMensaje('La fecha de agendamiento es obligatoria'); return; }

    setGuardando(true);
    setMensaje('');
    try {
      const body = {
        estado: resultado,
        observacion_asesora: obsAsesora.trim(),
      };

      if (resultado === 'agendado') {
        body.agendamiento_data = {
          equipos: agEquipos.join(', '),
          tipo_servicio: agTipo,
          fecha_agendamiento: agFecha,
          costo_cop: parseFloat(agCosto) || 0,
        };
      }

      await api.put(`/cotizaciones/${seleccionado.id}/resultado`, body);

      const msgs = {
        agendado: 'OK Servicio agendado correctamente.',
        piensa: 'OK Marcado como "desea pensarlo".',
        rechazado: 'OK Cliente se niega. Cotizacion cerrada.',
      };
      setMensaje(msgs[resultado]);
      setTimeout(() => { resetForm(); cargar(); }, 1200);
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Cotizacion Vigente</h1>
        <p className="text-slate-500 text-sm mt-0.5">Clientes con cotizacion de repuesto pendiente de llamar</p>
      </div>

      {mensaje && !seleccionado && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${mensaje.startsWith('OK') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {mensaje}
        </div>
      )}

      {cargando ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 text-sm">Cargando cotizaciones...</p>
        </div>
      ) : cotizaciones.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-slate-500 text-sm font-medium">No hay cotizaciones pendientes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cotizaciones.map(c => {
            const selected = seleccionado?.id === c.id;
            return (
              <div key={c.id}>
                <div className={`rounded-lg border px-4 py-3 transition-all cursor-pointer ${
                  selected
                    ? 'bg-violet-50 border-violet-200 ring-1 ring-violet-200'
                    : c.llamado ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-100 hover:bg-slate-50'
                }`} onClick={() => !selected && seleccionar(c)}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{c.nombre}</p>
                        {c.estado === 'piensa' && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded font-semibold">Desea pensarlo</span>
                        )}
                        {!c.llamado && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] rounded font-semibold">Pendiente por llamar</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.telefono}
                        {c.direccion && <> &middot; {c.direccion}</>}
                        {c.barrio && <>, {c.barrio}</>}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Equipo: {c.equipos} &middot; {c.tipo_servicio}
                      </p>
                      {c.observacion_gestor && (
                        <div className="mt-1.5 bg-violet-50 border border-violet-200 rounded px-2 py-1">
                          <p className="text-[11px] text-violet-700"><span className="font-semibold">Gestor:</span> {c.observacion_gestor}</p>
                        </div>
                      )}
                      {c.observacion_asesora && (
                        <div className="mt-1 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                          <p className="text-[11px] text-blue-700"><span className="font-semibold">Asesora:</span> {c.observacion_asesora}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-violet-700">{fmt(c.valor_cotizacion)}</p>
                      <p className="text-[10px] text-slate-400">Valor cotizacion</p>
                      <p className="text-[10px] text-slate-400 mt-1">Gestor: {c.gestor_nombre}</p>
                    </div>
                  </div>
                </div>

                {selected && (
                  <div className="ml-6 mt-2 rounded-lg border border-violet-200 bg-violet-50/30 p-4 space-y-4">
                    <h3 className="text-xs font-semibold text-violet-700 uppercase tracking-wider">
                      Resultado de llamada - {c.nombre}
                    </h3>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Observaciones de la llamada <span className="text-red-500">*</span></label>
                      <textarea className="input-field min-h-[80px] resize-none"
                        placeholder="Resultado de la llamada con el cliente..."
                        value={obsAsesora} onChange={e => setObsAsesora(e.target.value)} />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-2">Resultado <span className="text-red-500">*</span></label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setResultado('agendado')}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            resultado === 'agendado' ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                          }`}>
                          Agenda servicio
                        </button>
                        <button type="button" onClick={() => setResultado('piensa')}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            resultado === 'piensa' ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                          }`}>
                          Desea pensarlo
                        </button>
                        <button type="button" onClick={() => setResultado('rechazado')}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            resultado === 'rechazado' ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-red-300'
                          }`}>
                          Se niega
                        </button>
                      </div>
                    </div>

                    {resultado === 'agendado' && (
                      <div className="space-y-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <h4 className="text-xs font-semibold text-emerald-700">Datos del Agendamiento</h4>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">Equipos <span className="text-red-500">*</span></label>
                          <div className="flex flex-wrap gap-1.5">
                            {EQUIPOS.map(eq => (
                              <button key={eq} type="button"
                                onClick={() => setAgEquipos(prev => prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq])}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                                  agEquipos.includes(eq) ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-slate-200 text-slate-600'
                                }`}>
                                {eq}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de Servicio</label>
                            <select className="input-field" value={agTipo} onChange={e => setAgTipo(e.target.value)}>
                              {TIPOS_SERVICIO.map(t => <option key={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha <span className="text-red-500">*</span></label>
                            <input type="date" className="input-field" value={agFecha} onChange={e => setAgFecha(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Costo (COP)</label>
                            <input type="number" className="input-field" value={agCosto} onChange={e => setAgCosto(e.target.value)} />
                          </div>
                        </div>
                      </div>
                    )}

                    {mensaje && (
                      <div className={`rounded-lg px-4 py-3 text-sm ${
                        mensaje.startsWith('OK') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}>{mensaje}</div>
                    )}

                    <div className="flex justify-end gap-3">
                      <button onClick={resetForm} className="btn-secondary">Cancelar</button>
                      <button onClick={handleGuardar} disabled={guardando} className="btn-primary">
                        {guardando ? 'Guardando...' : 'Guardar Resultado'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
