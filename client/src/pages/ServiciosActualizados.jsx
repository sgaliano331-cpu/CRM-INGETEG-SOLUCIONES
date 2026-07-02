import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const ESTADOS = ['Cumplido', 'Pendiente por repuesto', 'Cancelado por el cliente'];

const estadoBadge = {
  'Agendado': 'badge-blue',
  'Cumplido': 'badge-green',
  'Pendiente por repuesto': 'badge-yellow',
  'Cancelado por el cliente': 'badge-red',
};

export default function ServiciosActualizados() {
  const { isCoordinador } = useAuth();

  const [clientes, setClientes] = useState([]);
  const [asesoras, setAsesoras] = useState([]);
  const [filtroAsesora, setFiltroAsesora] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaActiva, setBusquedaActiva] = useState('');
  const [cargando, setCargando] = useState(true);
  const debounceRef = useRef(null);

  const cargarClientes = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (filtroAsesora) params.append('asesora_id', filtroAsesora);
      if (filtroEstado) params.append('estado', filtroEstado);
      if (busquedaActiva) params.append('buscar', busquedaActiva);
      params.append('solo_agendados', '1');
      const { data } = await api.get(`/llamadas/clientes-llamados?${params}`);
      let lista = (data.clientes || []).filter(c =>
        c.agendamiento_id && c.estado_servicio !== 'Agendado'
      );
      if (filtroFechaDesde) {
        lista = lista.filter(c => c.fecha_atencion && c.fecha_atencion >= filtroFechaDesde);
      }
      if (filtroFechaHasta) {
        lista = lista.filter(c => c.fecha_atencion && c.fecha_atencion <= filtroFechaHasta);
      }
      setClientes(lista);
    } catch {
      setClientes([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    api.get('/clientes/asesoras/lista').then(({ data }) => setAsesoras(data.asesoras)).catch(() => {});
  }, []);

  useEffect(() => { cargarClientes(); }, [filtroAsesora, filtroEstado, filtroFechaDesde, filtroFechaHasta, busquedaActiva]);

  const handleBusqueda = (val) => {
    setBusqueda(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBusquedaActiva(val.trim()), 400);
  };

  const formatFecha = (iso) => {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Servicios Actualizados</h1>
        <p className="text-slate-500 text-sm mt-0.5">Historial de servicios ya gestionados por el equipo tecnico</p>
      </div>

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
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Asesora</label>
            <select className="input-field" value={filtroAsesora} onChange={e => setFiltroAsesora(e.target.value)}>
              <option value="">Todas las asesoras</option>
              {asesoras.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>

          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
            <select className="input-field" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>

          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Atendido desde</label>
            <input type="date" className="input-field"
              value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} />
          </div>

          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Atendido hasta</label>
            <input type="date" className="input-field"
              value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} />
          </div>

          <div className="ml-auto text-right">
            <span className="text-xs text-slate-400">Registros</span>
            <p className="text-lg font-bold text-slate-800">{clientes.length}</p>
          </div>
        </div>
      </div>

      {cargando ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 text-sm">Cargando registros...</p>
        </div>
      ) : clientes.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-500 text-sm font-medium">No hay servicios actualizados</p>
          <p className="text-slate-400 text-xs mt-1">Los servicios apareceran aqui despues de ser actualizados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clientes.map((c, idx) => (
            <div key={`${c.llamada_id}-${c.agendamiento_id || 'no'}-${idx}`}
              className="rounded-lg border bg-white border-slate-100 hover:bg-slate-50 px-4 py-3 transition-all">
              <div className="flex items-start gap-4">
                <span className="text-xs text-slate-400 font-semibold pt-0.5 w-6 text-right flex-shrink-0">
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.nombre}</p>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                      {c.asesora_nombre}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {c.telefono}
                    {c.direccion && <> &middot; {c.direccion}</>}
                    {c.barrio && <>, {c.barrio}</>}
                    {c.ciudad && <> &middot; {c.ciudad}</>}
                  </p>

                  {c.observaciones_tecnica && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                      <p className="text-[11px] text-amber-700">
                        <span className="font-semibold">Tecnico:</span> {c.observaciones_tecnica}
                      </p>
                    </div>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
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
                  {c.metodo_pago && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{c.metodo_pago}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
