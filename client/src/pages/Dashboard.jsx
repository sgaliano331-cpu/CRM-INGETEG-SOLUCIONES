import { useEffect, useState } from 'react';
import api from '../api/axios';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from 'recharts';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const fmtFH = iso => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtSeg = s => {
  if (!s) return '0s';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const CUSTOM_TOOLTIP = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
        <p className="text-slate-500 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [auditoria, setAuditoria] = useState(null);
  const [filtroAuditoria, setFiltroAuditoria] = useState({ asesora_id: '', fecha_desde: '', fecha_hasta: '' });
  const [asesoras, setAsesoras] = useState([]);
  const [tabAudit, setTabAudit] = useState('tabla');
  const [descansosAudit, setDescansosAudit] = useState(null);

  useEffect(() => {
    api.get('/dashboard/resumen').then(({ data }) => setData(data)).catch(() => {});
    api.get('/clientes/asesoras/lista').then(({ data }) => setAsesoras(data.asesoras)).catch(() => {});
    cargarAuditoria();
  }, []);

  const cargarAuditoria = async (filtros = {}) => {
    const params = new URLSearchParams(filtros).toString();
    try {
      const [audRes, descRes] = await Promise.all([
        api.get(`/dashboard/auditoria${params ? '?' + params : ''}`),
        api.get(`/descansos/auditoria${params ? '?' + params : ''}`),
      ]);
      setAuditoria(audRes.data);
      setDescansosAudit(descRes.data);
    } catch (err) {
      console.error('Error cargando auditoria:', err.message);
    }
  };

  const handleFiltroAudit = () => {
    cargarAuditoria(Object.fromEntries(
      Object.entries(filtroAuditoria).filter(([, v]) => v !== '')
    ));
  };

  const dataPorHora = data?.porHora?.map(h => ({
    hora: `${h.hora}h`,
    Agendamientos: h.total,
  })) || [];

  const dataPorDia = data?.porDia?.map(d => ({
    dia: DIAS[parseInt(d.dia_semana)],
    Agendamientos: d.total,
  })) || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <img src="/logo-ingeteg.png" alt="INGETEG" className="h-10 w-auto" />
        <div>
          <h1 className="text-lg font-bold text-slate-800">Dashboard Coordinador</h1>
          <p className="text-slate-500 text-sm mt-0.5">Analisis de rendimiento y auditoria del equipo comercial</p>
        </div>
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-4 gap-4">
          {data.porAsesora?.map(a => (
            <div key={a.id} className="card">
              <p className="text-xs text-slate-500 truncate font-medium">{a.nombre}</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{a.total_agendamientos}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">agendamientos</p>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-emerald-600 font-semibold">{fmt(a.ejecutado_cop || 0)}</p>
                <p className="text-[10px] text-slate-400">ejecutado</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Agendamientos por Hora del Dia</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dataPorHora} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hora" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Bar dataKey="Agendamientos" fill="#15803d" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Agendamientos por Dia de la Semana</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dataPorDia} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dia" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Bar dataKey="Agendamientos" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Queue status */}
      {data?.enCola && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Estado Actual de Cola por Asesora</h2>
          <div className="grid grid-cols-4 gap-3">
            {data.enCola.map(a => (
              <div key={a.id} className="bg-slate-50 rounded-lg p-4 text-center border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold mx-auto mb-2">
                  {a.nombre[0]}
                </div>
                <p className="text-xs text-slate-500 truncate">{a.nombre}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{a.pendientes_llamar}</p>
                <p className="text-[10px] text-slate-400">en cola</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Reporte de Auditoria &mdash; Tiempos de Atencion
          </h2>
          <div className="flex gap-1.5">
            <button onClick={() => setTabAudit('tabla')} className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${tabAudit === 'tabla' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Detalle</button>
            <button onClick={() => setTabAudit('resumen')} className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${tabAudit === 'resumen' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Resumen</button>
            <button onClick={() => setTabAudit('descansos')} className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${tabAudit === 'descansos' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Descansos</button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <select className="input-field flex-1" value={filtroAuditoria.asesora_id}
            onChange={e => setFiltroAuditoria(f => ({ ...f, asesora_id: e.target.value }))}>
            <option value="">Todas las asesoras</option>
            {asesoras.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <input type="date" className="input-field" value={filtroAuditoria.fecha_desde}
            onChange={e => setFiltroAuditoria(f => ({ ...f, fecha_desde: e.target.value }))} />
          <input type="date" className="input-field" value={filtroAuditoria.fecha_hasta}
            onChange={e => setFiltroAuditoria(f => ({ ...f, fecha_hasta: e.target.value }))} />
          <button onClick={handleFiltroAudit} className="btn-secondary">Filtrar</button>
        </div>

        {auditoria && tabAudit === 'resumen' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-3">Asesora</th>
                  <th className="text-right py-3 px-3">Llamadas</th>
                  <th className="text-right py-3 px-3">Tiempo Total</th>
                  <th className="text-right py-3 px-3">Promedio/Llamada</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.tiempoTotal.map(a => (
                  <tr key={a.usuario_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-800">{a.asesora}</td>
                    <td className="py-3 px-3 text-right text-slate-600">{a.total_llamadas}</td>
                    <td className="py-3 px-3 text-right text-emerald-700 font-semibold">{fmtSeg(a.tiempo_total_seg)}</td>
                    <td className="py-3 px-3 text-right text-slate-500">{fmtSeg(Math.round(a.tiempo_promedio_seg))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {auditoria && tabAudit === 'tabla' && (
          <div className="overflow-x-auto max-h-96 scrollbar-thin">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3">Asesora</th>
                  <th className="text-left py-2 px-3">Cliente</th>
                  <th className="text-left py-2 px-3">Inicio</th>
                  <th className="text-right py-2 px-3">Duracion</th>
                  <th className="text-center py-2 px-3">Agendo</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.registros.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-slate-600">{r.asesora}</td>
                    <td className="py-2 px-3 text-slate-800 font-medium">{r.cliente}</td>
                    <td className="py-2 px-3 text-slate-500">{fmtFH(r.inicio_llamada)}</td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-semibold">{fmtSeg(r.duracion_segundos)}</td>
                    <td className="py-2 px-3 text-center">
                      {r.acepto_servicio
                        ? <span className="badge badge-green">Si</span>
                        : <span className="badge badge-red">No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {descansosAudit && tabAudit === 'descansos' && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Resumen por Asesora</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3">Asesora</th>
                    <th className="text-left py-3 px-3">Tipo</th>
                    <th className="text-right py-3 px-3">Cantidad</th>
                    <th className="text-right py-3 px-3">Tiempo Total</th>
                    <th className="text-right py-3 px-3">Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {descansosAudit.resumen.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-800">{r.asesora}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          r.tipo === 'Almuerzo' ? 'bg-orange-100 text-orange-700' :
                          r.tipo === 'Desayuno' ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>{r.tipo}</span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">{r.total_descansos}</td>
                      <td className="py-3 px-3 text-right text-amber-700 font-semibold">{r.tiempo_total_min} min</td>
                      <td className="py-3 px-3 text-right text-slate-500">{r.tiempo_promedio_min} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto max-h-80 scrollbar-thin">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Detalle de Descansos</h3>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3">Asesora</th>
                    <th className="text-left py-2 px-3">Tipo</th>
                    <th className="text-left py-2 px-3">Salida</th>
                    <th className="text-left py-2 px-3">Entrada</th>
                    <th className="text-right py-2 px-3">Duracion</th>
                  </tr>
                </thead>
                <tbody>
                  {descansosAudit.registros.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-slate-600">{r.asesora}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          r.tipo === 'Almuerzo' ? 'bg-orange-100 text-orange-700' :
                          r.tipo === 'Desayuno' ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>{r.tipo}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-500">{fmtFH(r.salida)}</td>
                      <td className="py-2 px-3 text-slate-500">{fmtFH(r.entrada)}</td>
                      <td className="py-2 px-3 text-right text-amber-700 font-semibold">{r.duracion_minutos ? `${r.duracion_minutos} min` : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
