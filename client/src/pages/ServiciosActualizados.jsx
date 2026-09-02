import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import * as XLSX from 'xlsx';

const ESTADOS = ['Cumplido', 'Pendiente por repuesto', 'Cancelado por el cliente', 'Cotización vigente'];

const estadoBadge = {
  'Cumplido': 'badge-green',
  'Pendiente por repuesto': 'badge-yellow',
  'Cancelado por el cliente': 'badge-red',
  'Cotización vigente': 'badge-purple',
};

export default function ServiciosActualizados() {
  const { isGestor, isCoordinador } = useAuth();
  const [servicios, setServicios] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaActiva, setBusquedaActiva] = useState('');
  const [filtroLiquidado, setFiltroLiquidado] = useState('');
  const [filtroPago, setFiltroPago] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState({});
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
      params.append('ligero', '1');
      const { data } = await api.get(`/llamadas/gestion-servicios?${params}`);
      setServicios(data.servicios || []);
      setCambios({});
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

  const toggleCheck = (servicio) => {
    const estadoOriginal = !!servicio.liquidado;
    const estadoActual = cambios[servicio.id] !== undefined ? cambios[servicio.id] : estadoOriginal;
    const nuevoEstado = !estadoActual;

    if (nuevoEstado === estadoOriginal) {
      setCambios(prev => {
        const next = { ...prev };
        delete next[servicio.id];
        return next;
      });
    } else {
      setCambios(prev => ({ ...prev, [servicio.id]: nuevoEstado }));
    }
  };

  const estaLiquidado = (s) => {
    if (cambios[s.id] !== undefined) return cambios[s.id];
    return !!s.liquidado;
  };

  const hayCambios = Object.keys(cambios).length > 0;

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      const items = Object.entries(cambios).map(([id, liquidado]) => ({ id: Number(id), liquidado }));
      await api.put('/llamadas/liquidar-lote', { items });
      setServicios(prev => prev.map(s =>
        cambios[s.id] !== undefined ? { ...s, liquidado: cambios[s.id] ? 1 : 0 } : s
      ));
      setCambios({});
    } catch {
      // silenciar
    } finally {
      setGuardando(false);
    }
  };

  const descartarCambios = () => setCambios({});

  const serviciosFiltrados = servicios.filter(s => {
    if (filtroLiquidado !== '') {
      const liq = estaLiquidado(s);
      if (filtroLiquidado === 'si' && !liq) return false;
      if (filtroLiquidado === 'no' && liq) return false;
    }
    if (filtroPago !== '') {
      if (filtroPago === 'pendiente' && s.metodo_pago !== 'Pendiente por cobro') return false;
      if (filtroPago === 'efectivo' && s.metodo_pago !== 'Efectivo') return false;
      if (filtroPago === 'transferencia' && s.metodo_pago !== 'Transferencia') return false;
      if (filtroPago === 'sin_pago' && s.metodo_pago) return false;
    }
    return true;
  });

  const totalLiquidados = servicios.filter(s => estaLiquidado(s)).length;
  const puedeMarcar = isGestor || isCoordinador;

  const descargarExcel = () => {
    const datos = serviciosFiltrados.map(s => ({
      'Cliente': s.cliente_nombre,
      'Telefono': s.telefono,
      'Direccion': s.direccion || '',
      'Ciudad': s.ciudad || '',
      'Equipos': s.equipos || '',
      'Tipo Servicio': s.tipo_servicio || '',
      'Estado': s.estado_servicio,
      'Tecnico': s.tecnico || '',
      'Fecha Agendamiento': s.fecha_agendamiento || '',
      'Fecha Atencion': s.fecha_atencion || '',
      'Valor': s.costo_cop || 0,
      'Metodo Pago': s.metodo_pago || '',
      'Liquidado': estaLiquidado(s) ? 'Si' : 'No',
      'Observaciones': s.observaciones_tecnica || '',
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Servicios');
    XLSX.writeFile(wb, `Servicios_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

          {puedeMarcar && (
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Liquidacion</label>
              <select className="input-field" value={filtroLiquidado} onChange={e => setFiltroLiquidado(e.target.value)}>
                <option value="">Todos</option>
                <option value="si">Liquidados</option>
                <option value="no">Sin liquidar</option>
              </select>
            </div>
          )}

          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Metodo de pago</label>
            <select className="input-field" value={filtroPago} onChange={e => setFiltroPago(e.target.value)}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente por cobro</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="sin_pago">Sin metodo</option>
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

          <div className="ml-auto text-right flex items-center gap-3">
            <button onClick={descargarExcel} title="Descargar informe Excel"
              className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Excel
            </button>
            <div>
              <span className="text-xs text-slate-400">Registros</span>
              <p className="text-lg font-bold text-slate-800">{serviciosFiltrados.length}</p>
              {puedeMarcar && (
                <p className="text-[10px] text-emerald-600 font-medium">{totalLiquidados} liquidados</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {puedeMarcar && hayCambios && (
        <div className="sticky top-0 z-10 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-center justify-between shadow-sm">
          <p className="text-sm text-amber-800 font-medium">
            {Object.keys(cambios).length} {Object.keys(cambios).length === 1 ? 'cambio pendiente' : 'cambios pendientes'} por guardar
          </p>
          <div className="flex gap-2">
            <button onClick={descartarCambios}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all">
              Descartar
            </button>
            <button onClick={guardarCambios} disabled={guardando}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-1.5">
              {guardando ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Guardando...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Guardar liquidaciones
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 text-sm">Cargando registros...</p>
        </div>
      ) : serviciosFiltrados.length === 0 ? (
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
          {serviciosFiltrados.map((s, idx) => {
            const liq = estaLiquidado(s);
            const tienesCambio = cambios[s.id] !== undefined;
            return (
              <div key={s.id}
                className={`rounded-lg border bg-white px-4 py-3 transition-all ${
                  tienesCambio ? 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-200' :
                  liq ? 'border-emerald-200 bg-emerald-50/30' :
                  'border-slate-100 hover:bg-slate-50'
                }`}>
                <div className="flex items-start gap-4">
                  {puedeMarcar && (
                    <button
                      onClick={() => toggleCheck(s)}
                      className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        liq
                          ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600'
                          : 'border-slate-300 hover:border-emerald-400 text-transparent hover:text-emerald-300'
                      }`}
                      title={liq ? 'Desmarcar liquidado' : 'Marcar como liquidado'}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}

                  <span className="text-xs text-slate-400 font-semibold pt-0.5 w-6 text-right flex-shrink-0">
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{s.cliente_nombre}</p>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                        {s.asesora_nombre}
                      </span>
                      {liq && !tienesCambio && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                          LIQUIDADO
                        </span>
                      )}
                      {tienesCambio && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                          {cambios[s.id] ? 'MARCAR LIQUIDADO' : 'QUITAR LIQUIDADO'}
                        </span>
                      )}
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
                    <a href={`${api.defaults.baseURL}/llamadas/generar-pdf/${s.id}`}
                      target="_blank" rel="noopener noreferrer"
                      onClick={(e) => {
                        const token = localStorage.getItem('crm_token');
                        if (token) {
                          e.preventDefault();
                          window.open(`${api.defaults.baseURL}/llamadas/generar-pdf/${s.id}?token=${token}`, '_blank');
                        }
                      }}
                      className="inline-block mt-2 text-[10px] font-semibold bg-brand-600 text-white px-3 py-1 rounded-lg hover:bg-brand-700 transition-all">
                      Ver PDF
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
