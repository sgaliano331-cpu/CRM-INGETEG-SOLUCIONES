import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';

const ESTADOS = ['Cumplido', 'Pendiente por repuesto', 'Cancelado por el cliente', 'Cotización vigente'];

const estadoBadge = {
  'Cumplido': 'badge-green',
  'Pendiente por repuesto': 'badge-yellow',
  'Cancelado por el cliente': 'badge-red',
  'Cotización vigente': 'badge-purple',
};

export default function ServiciosActualizados() {
  const [servicios, setServicios] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaActiva, setBusquedaActiva] = useState('');
  const [cargando, setCargando] = useState(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.get('/llamadas/tecnicos').then(({ data }) => setTecnicos(data.tecnicos || [])).catch(() => {});
  }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.append('estado', filtroEstado);
      if (filtroTecnico) params.append('tecnico', filtroTecnico);
      if (fechaDesde) params.append('fecha_desde', fechaDesde);
      if (fechaHasta) params.append('fecha_hasta', fechaHasta);
      if (busquedaActiva) params.append('buscar', busquedaActiva);
      params.append('excluir_agendado', '1');
      const { data } = await api.get(`/llamadas/gestion-servicios?${params}`);
      setServicios(data.servicios || []);
    } catch {
      setServicios([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, [filtroEstado, filtroTecnico, fechaDesde, fechaHasta, busquedaActiva]);

  const handleBusqueda = (val) => {
    setBusqueda(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBusquedaActiva(val.trim()), 400);
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
          <input type="text" className="input-field max-w-md" placeholder="Nombre o telefono del cliente..."
            value={busqueda} onChange={e => handleBusqueda(e.target.value)} />
        </div>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
            <select className="input-field" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>

          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Tecnico</label>
            <select className="input-field" value={filtroTecnico} onChange={e => setFiltroTecnico(e.target.value)}>
              <option value="">Todos los tecnicos</option>
              {tecnicos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
            </select>
          </div>

          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Desde</label>
            <input type="date" className="input-field" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
          </div>

          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Hasta</label>
            <input type="date" className="input-field" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          </div>

          <div className="ml-auto text-right">
            <span className="text-xs text-slate-400">Registros</span>
            <p className="text-lg font-bold text-slate-800">{servicios.length}</p>
          </div>
        </div>
      </div>

      {cargando ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 text-sm">Cargando registros...</p>
        </div>
      ) : servicios.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-500 text-sm font-medium">No hay servicios actualizados</p>
          <p className="text-slate-400 text-xs mt-1">Los servicios apareceran aqui despues de ser actualizados por los tecnicos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {servicios.map((s, idx) => (
            <div key={s.id}
              className="rounded-lg border bg-white border-slate-100 hover:bg-slate-50 px-4 py-3 transition-all">
              <div className="flex items-start gap-4">
                <span className="text-xs text-slate-400 font-semibold pt-0.5 w-6 text-right flex-shrink-0">
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.cliente_nombre}</p>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                      {s.asesora_nombre}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {s.telefono}
                    {s.direccion && <> &middot; {s.direccion}</>}
                    {s.barrio && <>, {s.barrio}</>}
                    {s.ciudad && <> &middot; {s.ciudad}</>}
                  </p>

                  {s.observaciones_tecnica && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                      <p className="text-[11px] text-amber-700">
                        <span className="font-semibold">Tecnico:</span> {s.observaciones_tecnica}
                      </p>
                    </div>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <span className={`badge ${estadoBadge[s.estado_servicio] || 'badge-blue'}`}>
                    {s.estado_servicio}
                  </span>
                  {s.id_servicio && (
                    <p className="text-[10px] font-semibold text-indigo-600 mt-1">ID: {s.id_servicio}</p>
                  )}
                  {s.tecnico && (
                    <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">Tec: {s.tecnico}</p>
                  )}
                  {s.fecha_atencion && (
                    <p className="text-[10px] text-slate-500 mt-0.5">Atendido: {s.fecha_atencion}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">{s.equipos}</p>
                  <p className="text-xs text-slate-400">{s.tipo_servicio}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Agendado: {s.fecha_agendamiento}</p>
                  {s.costo_cop > 0 && (
                    <p className={`text-xs font-semibold mt-0.5 ${s.estado_servicio === 'Cancelado por el cliente' ? 'text-red-500 line-through' : 'text-emerald-700'}`}>
                      ${Number(s.costo_cop).toLocaleString('es-CO')}
                    </p>
                  )}
                  {s.metodo_pago && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.metodo_pago}</p>
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
