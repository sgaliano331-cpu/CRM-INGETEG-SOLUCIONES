import { useState, useEffect } from 'react';
import api from '../api/axios';

const ESTADOS = ['Agendado', 'Cumplido', 'Pendiente por repuesto', 'Cancelado por el cliente', 'Cotización vigente'];
const TECNICOS = ['HERNAN', 'FREDY', 'OMAR', 'SANCHEZ', 'EILER'];

const estadoBadge = {
  'Agendado': 'badge-blue',
  'Cumplido': 'badge-green',
  'Pendiente por repuesto': 'badge-yellow',
  'Cancelado por el cliente': 'badge-red',
  'Cotización vigente': 'badge-purple',
};

function hoy() {
  return new Date().toLocaleDateString('en-CA');
}

export default function GestionServicios() {
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('Agendado');
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState(null);
  const [tecnicosSel, setTecnicosSel] = useState([]);
  const [fechaAtencion, setFechaAtencion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargar = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.append('estado', filtroEstado);
      if (filtroTecnico) params.append('tecnico', filtroTecnico);
      if (fechaDesde) params.append('fecha_desde', fechaDesde);
      if (fechaHasta) params.append('fecha_hasta', fechaHasta);
      if (busqueda) params.append('buscar', busqueda);
      const { data } = await api.get(`/llamadas/gestion-servicios?${params}`);
      setServicios(data.servicios || []);
    } catch {
      setServicios([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, [filtroEstado, filtroTecnico, fechaDesde, fechaHasta]);

  const abrirAsignacion = (s) => {
    setEditando(s);
    setTecnicosSel(s.tecnico ? s.tecnico.split(', ').filter(Boolean) : []);
    setFechaAtencion(s.fecha_atencion || hoy());
    setMensaje('');
  };

  const toggleTecnico = (t) => {
    setTecnicosSel(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const guardarAsignacion = async () => {
    if (!editando) return;
    setGuardando(true);
    setMensaje('');
    try {
      await api.put('/llamadas/asignar-tecnico', {
        agendamiento_id: editando.id,
        tecnico: tecnicosSel.join(', '),
        fecha_atencion: fechaAtencion,
      });
      setMensaje('Asignado correctamente');
      setEditando(null);
      cargar();
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al asignar');
    } finally {
      setGuardando(false);
    }
  };

  const sinTecnico = servicios.filter(s => !s.tecnico);
  const conTecnico = servicios.filter(s => s.tecnico);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-800">Gestion de Servicios</h2>

      {/* Filtros */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-[11px] text-slate-500 font-semibold uppercase">Estado</label>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="input-field mt-1">
              <option value="">Todos</option>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-semibold uppercase">Tecnico</label>
            <select value={filtroTecnico} onChange={e => setFiltroTecnico(e.target.value)} className="input-field mt-1">
              <option value="">Todos</option>
              {TECNICOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-semibold uppercase">Desde</label>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="input-field mt-1" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-semibold uppercase">Hasta</label>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="input-field mt-1" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-semibold uppercase">Buscar</label>
            <div className="flex gap-2 mt-1">
              <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && cargar()}
                placeholder="Nombre, tel, ID..." className="input-field flex-1" />
              <button onClick={cargar} className="btn-primary px-3 text-sm">Buscar</button>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="flex gap-3 text-sm">
        <span className="bg-red-50 text-red-700 px-3 py-1 rounded-lg font-semibold">
          Sin asignar: {sinTecnico.length}
        </span>
        <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-semibold">
          Asignados: {conTecnico.length}
        </span>
        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-semibold">
          Total: {servicios.length}
        </span>
      </div>

      {/* Modal de asignacion */}
      {editando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditando(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800">Asignar Tecnico</h3>
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="font-semibold">{editando.cliente_nombre}</p>
              <p className="text-slate-500">{editando.equipos} — {editando.tipo_servicio}</p>
              <p className="text-slate-400 text-xs">{editando.direccion}, {editando.barrio} — {editando.ciudad}</p>
              <p className="text-slate-400 text-xs mt-1">Agendado: {editando.fecha_agendamiento}</p>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 font-semibold uppercase">Tecnicos</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TECNICOS.map(t => (
                  <button key={t} onClick={() => toggleTecnico(t)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      tecnicosSel.includes(t)
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 font-semibold uppercase">Fecha de atencion</label>
              <input type="date" value={fechaAtencion} onChange={e => setFechaAtencion(e.target.value)} className="input-field mt-1" />
            </div>

            {mensaje && <p className={`text-sm font-medium ${mensaje.includes('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{mensaje}</p>}

            <div className="flex gap-3">
              <button onClick={() => setEditando(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={guardarAsignacion} disabled={guardando || tecnicosSel.length === 0}
                className="btn-primary flex-1 disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      {cargando ? (
        <div className="text-center py-12 text-slate-400">Cargando servicios...</div>
      ) : servicios.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">No hay servicios con estos filtros</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 px-3 text-[11px] text-slate-400 font-semibold uppercase">Cliente</th>
                <th className="text-left py-2 px-3 text-[11px] text-slate-400 font-semibold uppercase">Equipo / Tipo</th>
                <th className="text-left py-2 px-3 text-[11px] text-slate-400 font-semibold uppercase">Fecha Agend.</th>
                <th className="text-left py-2 px-3 text-[11px] text-slate-400 font-semibold uppercase">Estado</th>
                <th className="text-left py-2 px-3 text-[11px] text-slate-400 font-semibold uppercase">Tecnico</th>
                <th className="text-left py-2 px-3 text-[11px] text-slate-400 font-semibold uppercase">Fecha Atencion</th>
                <th className="text-left py-2 px-3 text-[11px] text-slate-400 font-semibold uppercase">Costo</th>
                <th className="text-center py-2 px-3 text-[11px] text-slate-400 font-semibold uppercase">Accion</th>
              </tr>
            </thead>
            <tbody>
              {servicios.map(s => (
                <tr key={s.id} className={`border-b border-slate-50 hover:bg-slate-50 ${!s.tecnico ? 'bg-amber-50/40' : ''}`}>
                  <td className="py-2.5 px-3">
                    <p className="font-semibold text-slate-700 text-xs">{s.cliente_nombre}</p>
                    <p className="text-[11px] text-slate-400">{s.telefono}</p>
                  </td>
                  <td className="py-2.5 px-3">
                    <p className="text-xs text-slate-600">{s.equipos}</p>
                    <p className="text-[11px] text-slate-400">{s.tipo_servicio}</p>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">{s.fecha_agendamiento}</td>
                  <td className="py-2.5 px-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${estadoBadge[s.estado_servicio] || 'badge-blue'}`}>
                      {s.estado_servicio}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {s.tecnico ? (
                      <span className="text-xs text-emerald-700 font-medium">{s.tecnico}</span>
                    ) : (
                      <span className="text-xs text-red-500 font-medium">Sin asignar</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">{s.fecha_atencion || '—'}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-600 font-medium">
                    {s.costo_cop > 0 ? `$${s.costo_cop.toLocaleString('es-CO')}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button onClick={() => abrirAsignacion(s)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                        s.tecnico
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'bg-brand-600 text-white hover:bg-brand-700'
                      }`}>
                      {s.tecnico ? 'Reasignar' : 'Asignar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
