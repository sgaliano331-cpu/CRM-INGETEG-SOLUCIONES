import { useEffect, useState } from 'react';
import api from '../api/axios';

const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

export default function PendientesRepuesto() {
  const [pendientes, setPendientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [seleccionado, setSeleccionado] = useState(null);
  const [obsRepuesto, setObsRepuesto] = useState('');
  const [valorCotizacion, setValorCotizacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargar = () => {
    setCargando(true);
    api.get('/llamadas/pendientes-repuesto')
      .then(({ data }) => setPendientes(data.pendientes))
      .catch(() => setPendientes([]))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  const seleccionar = (p) => {
    setSeleccionado(p);
    setObsRepuesto('');
    setValorCotizacion('');
    setMensaje('');
  };

  const cancelar = () => {
    setSeleccionado(null);
    setMensaje('');
  };

  const handleEnviar = async () => {
    if (!obsRepuesto.trim()) { setMensaje('La observación de repuesto es obligatoria'); return; }
    if (!valorCotizacion || parseFloat(valorCotizacion) <= 0) { setMensaje('El valor de cotización debe ser mayor a 0'); return; }

    setGuardando(true);
    setMensaje('');
    try {
      await api.put(`/llamadas/enviar-cotizacion/${seleccionado.id}`, {
        observacion_repuesto: obsRepuesto.trim(),
        valor_cotizacion: parseFloat(valorCotizacion),
      });
      setMensaje('OK Cotización enviada a la asesora correctamente.');
      setTimeout(() => { cancelar(); cargar(); }, 1200);
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al enviar cotización');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Pendientes por Repuesto</h1>
        <p className="text-slate-500 text-sm mt-0.5">Servicios en espera de repuesto — agrega observación y valor de cotización para enviar a la asesora</p>
      </div>

      {mensaje && !seleccionado && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${mensaje.startsWith('OK') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {mensaje}
        </div>
      )}

      <div className="card">
        {cargando ? (
          <div className="text-center py-8 text-slate-500">Cargando...</div>
        ) : pendientes.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-slate-400 text-sm">No hay servicios pendientes por repuesto.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendientes.map(p => {
              const selected = seleccionado?.id === p.id;
              return (
                <div key={p.id}>
                  <div
                    className={`rounded-lg px-5 py-4 border transition-all cursor-pointer ${
                      selected
                        ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200'
                        : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                    }`}
                    onClick={() => !selected && seleccionar(p)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="badge badge-yellow">Pendiente repuesto</span>
                          <span className="text-xs text-slate-400">{p.fecha_agendamiento}</span>
                        </div>
                        <p className="font-semibold text-slate-800">{p.cliente_nombre}</p>
                        <p className="text-sm text-slate-500">{p.telefono} &middot; {p.ciudad}</p>
                        <div className="mt-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">Equipo(s):</span> {p.equipos} &middot; {p.tipo_servicio}
                        </div>
                        {p.obs_marcacion && (
                          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                            <p className="text-xs text-blue-700">
                              <span className="font-semibold">Obs. Marcacion:</span> {p.obs_marcacion}
                            </p>
                          </div>
                        )}
                        {p.obs_tecnica && (
                          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                            <p className="text-xs text-amber-700">
                              <span className="font-semibold">Obs. Tecnico:</span> {p.obs_tecnica}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[11px] text-slate-400 font-medium">Asesora</p>
                        <p className="text-sm text-slate-600">{p.asesora_nombre}</p>
                      </div>
                    </div>
                  </div>

                  {selected && (
                    <div className="ml-6 mt-2 rounded-lg border border-amber-200 bg-amber-50/30 p-4 space-y-4">
                      <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                        Enviar Cotización - {p.cliente_nombre}
                      </h3>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">
                          Observación de repuesto <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          className="input-field min-h-[80px] resize-none"
                          placeholder="Describe lo que se encontró al buscar los repuestos, disponibilidad, tiempos de entrega..."
                          value={obsRepuesto}
                          onChange={e => setObsRepuesto(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">
                          Valor total de la cotización (COP) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          className="input-field max-w-[300px]"
                          placeholder="Ej: 150000"
                          value={valorCotizacion}
                          onChange={e => setValorCotizacion(e.target.value)}
                        />
                        {valorCotizacion && parseFloat(valorCotizacion) > 0 && (
                          <p className="text-xs text-amber-700 font-medium mt-1">
                            {fmt(parseFloat(valorCotizacion))}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">
                          Este valor será comunicado al cliente por la asesora correspondiente
                        </p>
                      </div>

                      {mensaje && (
                        <div className={`rounded-lg px-4 py-3 text-sm ${
                          mensaje.startsWith('OK')
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>{mensaje}</div>
                      )}

                      <div className="flex justify-end gap-3">
                        <button onClick={cancelar} className="btn-secondary">Cancelar</button>
                        <button onClick={handleEnviar} disabled={guardando} className="btn-primary">
                          {guardando ? 'Enviando...' : 'Enviar Cotización a Asesora'}
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
    </div>
  );
}
