import { useState, useEffect } from 'react';
import api from '../api/axios';

const TABS = ['Resumen', 'Logins', 'Acciones', 'Sesiones'];

export default function Auditoria() {
  const [tab, setTab] = useState('Resumen');
  const [stats, setStats] = useState(null);
  const [logins, setLogins] = useState({ data: [], total: 0, pages: 0 });
  const [actions, setActions] = useState({ data: [], total: 0, pages: 0 });
  const [sessions, setSessions] = useState({ data: [], total: 0, pages: 0 });
  const [loginPage, setLoginPage] = useState(1);
  const [actionPage, setActionPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const [filterUser, setFilterUser] = useState('');
  const [filterSuccess, setFilterSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/audit/stats').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'Logins') {
      setLoading(true);
      const params = { page: loginPage, limit: 20 };
      if (filterUser) params.username = filterUser;
      if (filterSuccess) params.success = filterSuccess;
      api.get('/audit/logins', { params })
        .then(({ data }) => { setLogins(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [tab, loginPage, filterUser, filterSuccess]);

  useEffect(() => {
    if (tab === 'Acciones') {
      setLoading(true);
      api.get('/audit/actions', { params: { page: actionPage, limit: 20 } })
        .then(({ data }) => { setActions(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [tab, actionPage]);

  useEffect(() => {
    if (tab === 'Sesiones') {
      setLoading(true);
      api.get('/audit/sessions', { params: { page: sessionPage, limit: 20, activas: 'true' } })
        .then(({ data }) => { setSessions(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [tab, sessionPage]);

  const fmt = (d) => d ? new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '-';

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Auditoria de Seguridad</h1>
      <p className="text-sm text-slate-500 mb-6">Monitoreo de accesos, acciones y sesiones del sistema</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Resumen */}
      {tab === 'Resumen' && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Logins exitosos (24h)" value={stats.logins_exitosos_24h} color="emerald" />
          <StatCard label="Logins fallidos (24h)" value={stats.logins_fallidos_24h} color="red" />
          <StatCard label="Sesiones activas" value={stats.sesiones_activas} color="blue" />
          <StatCard label="Acciones hoy" value={stats.acciones_hoy} color="amber" />
        </div>
      )}

      {/* Logins */}
      {tab === 'Logins' && (
        <div>
          <div className="flex gap-3 mb-4">
            <input placeholder="Filtrar por usuario..." value={filterUser} onChange={e => { setFilterUser(e.target.value); setLoginPage(1); }}
              className="px-3 py-2 border rounded-lg text-sm w-48" />
            <select value={filterSuccess} onChange={e => { setFilterSuccess(e.target.value); setLoginPage(1); }}
              className="px-3 py-2 border rounded-lg text-sm">
              <option value="">Todos</option>
              <option value="true">Exitosos</option>
              <option value="false">Fallidos</option>
            </select>
          </div>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium">Resultado</th>
                  <th className="text-left px-4 py-3 font-medium">Razon</th>
                  <th className="text-left px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>
                ) : logins.data.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin registros</td></tr>
                ) : logins.data.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-600">{fmt(l.created_at)}</td>
                    <td className="px-4 py-2.5 font-medium">{l.username}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${l.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {l.success ? 'OK' : 'FALLO'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{l.failure_reason || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{l.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={loginPage} pages={logins.pages} setPage={setLoginPage} total={logins.total} />
        </div>
      )}

      {/* Acciones */}
      {tab === 'Acciones' && (
        <div>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium">Accion</th>
                  <th className="text-left px-4 py-3 font-medium">Tabla</th>
                  <th className="text-left px-4 py-3 font-medium">Registro</th>
                  <th className="text-left px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>
                ) : actions.data.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin registros</td></tr>
                ) : actions.data.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-600">{fmt(a.created_at)}</td>
                    <td className="px-4 py-2.5 font-medium">{a.username}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        a.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700' :
                        a.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>{a.action}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{a.table_name}</td>
                    <td className="px-4 py-2.5 text-slate-500">#{a.record_id || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{a.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={actionPage} pages={actions.pages} setPage={setActionPage} total={actions.total} />
        </div>
      )}

      {/* Sesiones */}
      {tab === 'Sesiones' && (
        <div>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium">Inicio</th>
                  <th className="text-left px-4 py-3 font-medium">Expira</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="text-left px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>
                ) : sessions.data.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin sesiones activas</td></tr>
                ) : sessions.data.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium">{s.nombre || s.username}</td>
                    <td className="px-4 py-2.5 text-slate-600">{fmt(s.created_at)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{fmt(s.expires_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        s.revoked_at ? 'bg-red-100 text-red-700' :
                        new Date(s.expires_at) < new Date() ? 'bg-slate-100 text-slate-500' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {s.revoked_at ? 'Revocada' : new Date(s.expires_at) < new Date() ? 'Expirada' : 'Activa'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{s.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={sessionPage} pages={sessions.pages} setPage={setSessionPage} total={sessions.total} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-3xl font-bold">{value ?? '-'}</p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
    </div>
  );
}

function Pagination({ page, pages, setPage, total }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
      <span>{total} registros</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
          className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-slate-50">Anterior</button>
        <span className="px-3 py-1.5">Pag {page} de {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
          className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-slate-50">Siguiente</button>
      </div>
    </div>
  );
}
