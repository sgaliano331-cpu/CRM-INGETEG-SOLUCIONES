import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const ESTADOS = ['Agendado', 'Cumplido', 'Pendiente por repuesto', 'Cancelado por el cliente'];
const METODOS_PAGO = ['Efectivo', 'Pendiente por cobro', 'Transferencia', 'Garantía'];
const EQUIPOS_DISPONIBLES = [
  'Cubierta', 'Estufas', 'Calentador', 'Horno', 'Campana Extractora',
  'Lavadora', 'Nevera', 'Aire Acondicionado', 'Redes de Gas (Reparacion)', 'Redes de Gas (Mantenimiento)'
];
const TIPOS_SERVICIO = ['Mantenimiento', 'Reparación', 'Garantía'];
const MOTIVOS_RECHAZO = ['No le interesa', 'No tiene dinero', 'Ya lo realiza con otra empresa', 'Tiene una mala experiencia', 'Número fuera de servicio', 'No contesta', 'Usuario se comunica', 'Se esta gestionando por WhatsApp', 'Número equivocado', 'Ya realizo el servicio con Ingeteg'];
const TECNICOS = ['HERNAN', 'FREDY', 'OMAR', 'SANCHEZ', 'EILER'];

const estadoBadge = {
  'Agendado': 'badge-blue',
  'Cumplido': 'badge-green',
  'Pendiente por repuesto': 'badge-yellow',
  'Cancelado por el cliente': 'badge-red',
};

export default function ActualizacionTecnica() {
  const { isCoordinador, isGestor } = useAuth();

  const [clientes, setClientes] = useState([]);
  const [asesoras, setAsesoras] = useState([]);
  const [filtroAsesora, setFiltroAsesora] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaActiva, setBusquedaActiva] = useState('');
  const [cargando, setCargando] = useState(true);
  const debounceRef = useRef(null);

  const [seleccionado, setSeleccionado] = useState(null);
  const [modoForm, setModoForm] = useState('');
  const [estado, setEstado] = useState('');
  const [metodo, setMetodo] = useState('');
  const [obsTecnica, setObsTecnica] = useState('');
  const [costoCop, setCostoCop] = useState('');
  const [comprobante, setComprobante] = useState(null);
  const [idServicio, setIdServicio] = useState('');
  const [tecnicosSel, setTecnicosSel] = useState([]);
  const [fechaAtencion, setFechaAtencion] = useState('');

  const [nuevoEquipos, setNuevoEquipos] = useState([]);
  const [nuevoTipo, setNuevoTipo] = useState('Mantenimiento');
  const [nuevoFecha, setNuevoFecha] = useState('');
  const [nuevoCosto, setNuevoCosto] = useState('');
  const [nuevoObs, setNuevoObs] = useState('');

  // Reprogramar state
  const [repFecha, setRepFecha] = useState('');
  const [repHora, setRepHora] = useState('');
  const [repMotivo, setRepMotivo] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargarClientes = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (filtroAsesora) params.append('asesora_id', filtroAsesora);
      if (isGestor && !isCoordinador) {
        params.append('estado', 'Agendado');
      } else if (filtroEstado) {
        params.append('estado', filtroEstado);
      }
      if (busquedaActiva) params.append('buscar', busquedaActiva);
      const { data } = await api.get(`/llamadas/clientes-llamados?${params}`);
      let lista = data.clientes;
      if (isGestor && !isCoordinador) {
        lista = lista.filter(c => c.agendamiento_id);
      }
      if (filtroMotivo) {
        lista = lista.filter(c => c.observaciones && c.observaciones.startsWith(`[${filtroMotivo}]`));
      }
      setClientes(lista);
    } catch {
      setClientes([]);
    } finally {
      setCargando(false);
    }
  };

  const esGlobal = isCoordinador || isGestor;

  useEffect(() => {
    if (esGlobal) {
      api.get('/clientes/asesoras/lista').then(({ data }) => setAsesoras(data.asesoras)).catch(() => {});
    }
  }, [esGlobal]);

  useEffect(() => { cargarClientes(); }, [filtroAsesora, filtroEstado, busquedaActiva, filtroMotivo]);

  const handleBusqueda = (val) => {
    setBusqueda(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBusquedaActiva(val.trim()), 400);
  };

  const resetForm = () => {
    setSeleccionado(null);
    setModoForm('');
    setMensaje('');
    setComprobante(null);
  };

  const seleccionarActualizar = (c) => {
    setSeleccionado(c);
    setModoForm('actualizar');
    setEstado(c.estado_servicio || '');
    setMetodo(c.metodo_pago || '');
    setObsTecnica(c.observaciones_tecnica || '');
    setCostoCop(String(c.costo_cop || ''));
    setIdServicio(c.id_servicio || '');
    setTecnicosSel(c.tecnico ? c.tecnico.split(', ') : []);
    setFechaAtencion(c.fecha_atencion || '');
    setComprobante(null);
    setMensaje('');
  };

  const seleccionarNuevo = (c) => {
    setSeleccionado(c);
    setModoForm('nuevo');
    setNuevoEquipos([]);
    setNuevoTipo('Mantenimiento');
    setNuevoFecha('');
    setNuevoCosto('');
    setNuevoObs('');
    setMensaje('');
  };

  const seleccionarReprogramar = (c) => {
    setSeleccionado(c);
    setModoForm('reprogramar');
    setRepFecha('');
    setRepHora('');
    setRepMotivo('');
    setMensaje('');
  };

  const handleGuardarActualizacion = async () => {
    if (!estado || (estado !== 'Cancelado por el cliente' && !metodo)) { setMensaje('Estado y metodo de pago son obligatorios'); return; }
    setGuardando(true);
    setMensaje('');
    try {
      const fd = new FormData();
      fd.append('estado_servicio', estado);
      fd.append('metodo_pago', metodo);
      fd.append('observaciones_tecnica', obsTecnica.trim());
      if (isGestor || isCoordinador) {
        fd.append('id_servicio', idServicio.trim());
        fd.append('tecnico', tecnicosSel.join(', '));
        fd.append('fecha_atencion', fechaAtencion);
      }
      if (isCoordinador || isGestor) fd.append('costo_cop', costoCop);
      if (comprobante) fd.append('comprobante', comprobante);

      await api.put(`/llamadas/actualizar-servicio/${seleccionado.agendamiento_id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMensaje('OK Servicio actualizado correctamente.');
      setTimeout(() => { resetForm(); cargarClientes(); }, 1200);
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar en el servidor');
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardarNuevo = async () => {
    if (nuevoEquipos.length === 0) { setMensaje('Selecciona al menos un equipo'); return; }
    if (!nuevoFecha) { setMensaje('La fecha de agendamiento es obligatoria'); return; }
    setGuardando(true);
    setMensaje('');
    try {
      await api.post('/llamadas/nuevo-agendamiento', {
        cliente_id: seleccionado.cliente_id,
        equipos: nuevoEquipos.join(', '),
        tipo_servicio: nuevoTipo,
        fecha_agendamiento: nuevoFecha,
        costo_cop: parseFloat(nuevoCosto) || 0,
        observaciones: nuevoObs.trim() || 'Nuevo agendamiento',
      });
      setMensaje('OK Nuevo servicio agendado correctamente.');
      setTimeout(() => { resetForm(); cargarClientes(); }, 1200);
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al agendar servicio');
    } finally {
      setGuardando(false);
    }
  };

  const handleReprogramar = async () => {
    if (!repFecha || !repHora) { setMensaje('Fecha y hora son obligatorias'); return; }
    setGuardando(true);
    setMensaje('');
    try {
      await api.post('/llamadas/reprogramar', {
        cliente_id: seleccionado.cliente_id,
        agendamiento_id: seleccionado.agendamiento_id || null,
        fecha_reprogramacion: repFecha,
        hora_reprogramacion: repHora,
        motivo: repMotivo.trim() || null,
      });
      setMensaje('OK Llamada reprogramada correctamente.');
      setTimeout(resetForm, 1200);
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al reprogramar');
    } finally {
      setGuardando(false);
    }
  };

  const formatFecha = (iso) => {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isSelected = (c, idx) =>
    seleccionado?.cliente_id === c.cliente_id && seleccionado?.llamada_id === c.llamada_id
    && seleccionado?.agendamiento_id === c.agendamiento_id;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      <div>
        <h1 className="text-lg font-bold text-slate-800">
          {isGestor && !isCoordinador ? 'Servicios Pendientes' : 'Actualizacion Tecnica'}
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {isGestor && !isCoordinador
            ? 'Servicios agendados pendientes por actualizacion tecnica'
            : esGlobal
              ? 'Todos los clientes gestionados por el equipo de asesoras'
              : 'Clientes que han pasado por tu cola de llamadas'}
        </p>
      </div>

      {/* Search + Filters */}
      <div className="card space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Buscar cliente</label>
          <input
            type="text"
            className="input-field max-w-md"
            placeholder="Nombre o telefono del cliente..."
            value={busqueda}
            onChange={e => handleBusqueda(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-4 flex-wrap">
          {esGlobal && (
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Asesora</label>
              <select className="input-field" value={filtroAsesora} onChange={e => setFiltroAsesora(e.target.value)}>
                <option value="">Todas las asesoras</option>
                {asesoras.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          )}

          {!(isGestor && !isCoordinador) && (
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
              <select className="input-field" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
                <option value="Sin agendar">Sin agendar</option>
              </select>
            </div>
          )}

          {!(isGestor && !isCoordinador) && (
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Motivo de rechazo</label>
              <select className="input-field" value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value)}>
                <option value="">Todos los motivos</option>
                {MOTIVOS_RECHAZO.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          <div className="ml-auto text-right">
            <span className="text-xs text-slate-400">Registros</span>
            <p className="text-lg font-bold text-slate-800">{clientes.length}</p>
          </div>
        </div>
      </div>

      {/* List */}
      {cargando ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 text-sm">Cargando registros...</p>
        </div>
      ) : clientes.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-slate-500 text-sm font-medium">No hay clientes que mostrar</p>
          <p className="text-slate-400 text-xs mt-1">
            {busquedaActiva ? 'No se encontraron resultados para la busqueda' : 'Los clientes apareceran aqui despues de ser llamados'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {clientes.map((c, idx) => {
            const tieneAgendamiento = !!c.agendamiento_id;
            const selected = isSelected(c, idx);

            return (
              <div key={`${c.llamada_id}-${c.agendamiento_id || 'no'}-${idx}`}>
                <div className={`rounded-lg border px-4 py-3 transition-all ${
                  selected
                    ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-200'
                    : 'bg-white border-slate-100 hover:bg-slate-50'
                }`}>
                  <div className="flex items-start gap-4">
                    <span className="text-xs text-slate-400 font-semibold pt-0.5 w-6 text-right flex-shrink-0">
                      {idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{c.nombre}</p>
                        {esGlobal && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                            {c.asesora_nombre}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.telefono}
                        {c.direccion && <> &middot; {c.direccion}</>}
                        {c.barrio && <>, {c.barrio}</>}
                        {c.ciudad && <> &middot; {c.ciudad}</>}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Llamada: {formatFecha(c.fin_llamada || c.inicio_llamada)}
                        {c.duracion_segundos != null && <> &middot; {Math.round(c.duracion_segundos / 60)} min</>}
                      </p>
                      {c.observaciones && (
                        <p className="text-xs text-slate-400 italic mt-0.5 truncate max-w-lg">
                          &ldquo;{c.observaciones}&rdquo;
                        </p>
                      )}

                      <div className="flex gap-2 mt-2 flex-wrap">
                        {tieneAgendamiento && (
                          <button
                            onClick={() => seleccionarActualizar(c)}
                            className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all ${
                              selected && modoForm === 'actualizar'
                                ? 'bg-emerald-700 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}>
                            Actualizar servicio
                          </button>
                        )}
                        <button
                          onClick={() => seleccionarNuevo(c)}
                          className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all ${
                            selected && modoForm === 'nuevo'
                              ? 'bg-emerald-700 text-white'
                              : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                          }`}>
                          + Agendar servicio
                        </button>
                        <button
                          onClick={() => seleccionarReprogramar(c)}
                          className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all ${
                            selected && modoForm === 'reprogramar'
                              ? 'bg-blue-700 text-white'
                              : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                          }`}>
                          Reprogramar llamada
                        </button>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      {tieneAgendamiento ? (
                        <>
                          <span className={`badge ${estadoBadge[c.estado_servicio] || 'badge-blue'}`}>
                            {c.estado_servicio}
                          </span>
                          {c.id_servicio && (
                            <p className="text-[10px] font-semibold text-indigo-600 mt-1">ID: {c.id_servicio}</p>
                          )}
                          {c.tecnico && (
                            <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">Tec: {c.tecnico}</p>
                          )}
                          {c.fecha_atencion && (
                            <p className="text-[10px] text-slate-500 mt-0.5">Atendido: {c.fecha_atencion}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">{c.equipos}</p>
                          <p className="text-xs text-slate-400">{c.tipo_servicio}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Agendado: {c.fecha_agendamiento}</p>
                          {c.costo_cop > 0 && (
                            <p className={`text-xs font-semibold mt-0.5 ${c.estado_servicio === 'Cancelado por el cliente' ? 'text-red-500 line-through' : 'text-emerald-700'}`}>
                              ${Number(c.costo_cop).toLocaleString('es-CO')}
                            </p>
                          )}
                          {c.observaciones_tecnica && (
                            <p className="text-[10px] text-slate-500 mt-1 italic max-w-[250px] text-left">
                              Tecnico: &ldquo;{c.observaciones_tecnica}&rdquo;
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] rounded font-medium">
                          Sin agendar
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* FORM: Update existing agendamiento */}
                {selected && modoForm === 'actualizar' && tieneAgendamiento && (
                  <div className="ml-10 mt-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-4">
                    <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                      Actualizar servicio de {c.nombre}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Estado del Servicio *</label>
                        <select className="input-field" value={estado} onChange={e => {
                          setEstado(e.target.value);
                          if (e.target.value === 'Cancelado por el cliente') { setMetodo('N/A'); setComprobante(null); }
                          else if (metodo === 'N/A') setMetodo('');
                        }}>
                          <option value="">Seleccionar...</option>
                          {ESTADOS.map(e => <option key={e}>{e}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Metodo de Pago {estado !== 'Cancelado por el cliente' && '*'}</label>
                        <select className="input-field" value={metodo}
                          disabled={estado === 'Cancelado por el cliente'}
                          onChange={e => { setMetodo(e.target.value); setComprobante(null); }}>
                          <option value="">Seleccionar...</option>
                          {estado === 'Cancelado por el cliente' && <option value="N/A">N/A</option>}
                          {METODOS_PAGO.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>

                      {(isGestor || isCoordinador) && (
                        <>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1.5">ID del Servicio {estado !== 'Cancelado por el cliente' && '*'}</label>
                            <input type="text" className="input-field max-w-[250px]"
                              placeholder={estado === 'Cancelado por el cliente' ? 'N/A' : 'Ej: SRV-001, OT-1234...'}
                              disabled={estado === 'Cancelado por el cliente'}
                              value={estado === 'Cancelado por el cliente' ? '' : idServicio}
                              onChange={e => setIdServicio(e.target.value)} />
                          </div>

                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1.5">Tecnico(s) *</label>
                            <div className="flex flex-wrap gap-2">
                              {TECNICOS.map(t => (
                                <button key={t} type="button"
                                  onClick={() => setTecnicosSel(prev =>
                                    prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                                  )}
                                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                                    tecnicosSel.includes(t)
                                      ? 'bg-emerald-700 border-emerald-700 text-white'
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                  }`}>
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha de Atencion *</label>
                            <input type="date" className="input-field max-w-[250px]"
                              value={fechaAtencion} onChange={e => setFechaAtencion(e.target.value)} />
                          </div>
                        </>
                      )}

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Observaciones del servicio tecnico</label>
                        <textarea className="input-field min-h-[80px] resize-none"
                          placeholder="Que se encontro? Que se hizo? Detalles del diagnostico o reparacion..."
                          value={obsTecnica} onChange={e => setObsTecnica(e.target.value)} />
                      </div>

                      {(isCoordinador || isGestor) && (
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">Valor del Servicio (COP)</label>
                          <input type="number" className="input-field max-w-[250px]" placeholder="0"
                            value={costoCop} onChange={e => setCostoCop(e.target.value)} />
                        </div>
                      )}

                      {metodo === 'Transferencia' && (
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">Comprobante de Transferencia *</label>
                          <input type="file" accept="image/*,application/pdf"
                            className="input-field text-sm"
                            onChange={e => setComprobante(e.target.files[0] || null)} />
                          {!comprobante && !c.comprobante_pago_url && (
                            <p className="text-xs text-red-500 mt-1">Debes subir el comprobante para guardar con Transferencia</p>
                          )}
                        </div>
                      )}

                      {c.comprobante_pago_url && (
                        <div className="col-span-2">
                          <a href={c.comprobante_pago_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-emerald-700 underline font-medium hover:text-emerald-800">
                            Ver comprobante de pago
                          </a>
                        </div>
                      )}
                    </div>

                    {mensaje && (
                      <div className={`rounded-lg px-4 py-3 text-sm ${
                        mensaje.startsWith('OK') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}>{mensaje}</div>
                    )}

                    <div className="flex justify-end gap-3">
                      <button onClick={resetForm} className="btn-secondary">Cancelar</button>
                      <button onClick={handleGuardarActualizacion} disabled={guardando} className="btn-primary">
                        {guardando ? 'Guardando...' : 'Actualizar Servicio'}
                      </button>
                    </div>
                  </div>
                )}

                {/* FORM: New agendamiento */}
                {selected && modoForm === 'nuevo' && (
                  <div className="ml-10 mt-2 rounded-lg border border-amber-200 bg-amber-50/30 p-4 space-y-4">
                    <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                      Agendar nuevo servicio para {c.nombre}
                    </h3>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-2">Tipo de Equipo(s) *</label>
                      <div className="flex flex-wrap gap-1.5">
                        {EQUIPOS_DISPONIBLES.map(eq => (
                          <button key={eq} type="button"
                            onClick={() => setNuevoEquipos(prev =>
                              prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]
                            )}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                              nuevoEquipos.includes(eq)
                                ? 'bg-emerald-700 border-emerald-700 text-white'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}>
                            {eq}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Tipo de Servicio</label>
                        <select className="input-field" value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value)}>
                          {TIPOS_SERVICIO.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha de Agendamiento *</label>
                        <input type="date" className="input-field" value={nuevoFecha}
                          onChange={e => setNuevoFecha(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Costo del Servicio (COP)</label>
                        <input type="number" className="input-field" placeholder="0" value={nuevoCosto}
                          onChange={e => setNuevoCosto(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Observaciones</label>
                      <textarea className="input-field min-h-[60px] resize-none"
                        placeholder="Motivo del nuevo agendamiento..."
                        value={nuevoObs} onChange={e => setNuevoObs(e.target.value)} />
                    </div>

                    {mensaje && (
                      <div className={`rounded-lg px-4 py-3 text-sm ${
                        mensaje.startsWith('OK') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}>{mensaje}</div>
                    )}
                    <div className="flex justify-end gap-3">
                      <button onClick={resetForm} className="btn-secondary">Cancelar</button>
                      <button onClick={handleGuardarNuevo} disabled={guardando} className="btn-primary">
                        {guardando ? 'Agendando...' : 'Agendar Servicio'}
                      </button>
                    </div>
                  </div>
                )}

                {/* FORM: Reprogramar llamada */}
                {selected && modoForm === 'reprogramar' && (
                  <div className="ml-10 mt-2 rounded-lg border border-blue-200 bg-blue-50/30 p-4 space-y-4">
                    <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                      Reprogramar llamada para {c.nombre}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha de llamada *</label>
                        <input type="date" className="input-field" value={repFecha}
                          onChange={e => setRepFecha(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Hora de llamada *</label>
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

                    {mensaje && (
                      <div className={`rounded-lg px-4 py-3 text-sm ${
                        mensaje.startsWith('OK') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}>{mensaje}</div>
                    )}
                    <div className="flex justify-end gap-3">
                      <button onClick={resetForm} className="btn-secondary">Cancelar</button>
                      <button onClick={handleReprogramar} disabled={guardando} className="btn-primary">
                        {guardando ? 'Guardando...' : 'Reprogramar Llamada'}
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
