import { useState, useEffect } from 'react';
import api from '../api/axios';

const ROLES = ['COORDINADOR', 'GESTOR', 'ASESORA', 'TECNICO'];
const ROL_COLORS = {
  COORDINADOR: 'bg-emerald-100 text-emerald-700',
  GESTOR: 'bg-blue-100 text-blue-700',
  ASESORA: 'bg-purple-100 text-purple-700',
  TECNICO: 'bg-amber-100 text-amber-700',
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCrear, setShowCrear] = useState(false);
  const [showPassword, setShowPassword] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [form, setForm] = useState({ username: '', nombre: '', password: '', rol: 'ASESORA' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const fetchUsuarios = () => {
    api.get('/usuarios')
      .then(({ data }) => { setUsuarios(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const flash = (text, isError = false) => {
    if (isError) { setError(text); setMsg(''); }
    else { setMsg(text); setError(''); }
    setTimeout(() => { setMsg(''); setError(''); }, 3000);
  };

  const crearUsuario = async (e) => {
    e.preventDefault();
    try {
      await api.post('/usuarios', form);
      flash(`Usuario "${form.username}" creado`);
      setForm({ username: '', nombre: '', password: '', rol: 'ASESORA' });
      setShowCrear(false);
      fetchUsuarios();
    } catch (err) {
      flash(err.response?.data?.error || 'Error al crear usuario', true);
    }
  };

  const cambiarPassword = async (id) => {
    if (!newPass || newPass.length < 4) return flash('Minimo 4 caracteres', true);
    try {
      const { data } = await api.put(`/usuarios/${id}/password`, { password: newPass });
      flash(data.message);
      setShowPassword(null);
      setNewPass('');
    } catch (err) {
      flash(err.response?.data?.error || 'Error', true);
    }
  };

  const toggleActivo = async (u) => {
    try {
      const { data } = await api.put(`/usuarios/${u.id}/toggle`);
      flash(data.message);
      fetchUsuarios();
    } catch (err) {
      flash(err.response?.data?.error || 'Error', true);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Gestion de Usuarios</h1>
        <button
          onClick={() => setShowCrear(!showCrear)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Usuario
        </button>
      </div>

      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{msg}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {showCrear && (
        <form onSubmit={crearUsuario} className="mb-6 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Crear Usuario</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Usuario (login)</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre completo</label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contrasena</label>
              <input
                type="text"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
                minLength={4}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rol</label>
              <select
                value={form.rol}
                onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
              Crear
            </button>
            <button type="button" onClick={() => setShowCrear(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Usuario</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Nombre</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Rol</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Estado</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50 ${u.activo !== 1 ? 'opacity-50' : ''}`}>
                <td className="py-3 px-4 text-sm font-mono text-slate-700">{u.username}</td>
                <td className="py-3 px-4 text-sm text-slate-800 font-medium">{u.nombre}</td>
                <td className="py-3 px-4">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROL_COLORS[u.rol] || 'bg-slate-100 text-slate-600'}`}>
                    {u.rol}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.activo === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {u.activo === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => { setShowPassword(showPassword === u.id ? null : u.id); setNewPass(''); }}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                      title="Cambiar contrasena"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => toggleActivo(u)}
                      className={`p-1.5 rounded-lg transition-colors ${u.activo === 1 ? 'hover:bg-red-50 text-red-500' : 'hover:bg-green-50 text-green-600'}`}
                      title={u.activo === 1 ? 'Desactivar' : 'Activar'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d={u.activo === 1
                            ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                            : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'}
                        />
                      </svg>
                    </button>
                  </div>
                  {showPassword === u.id && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={newPass}
                        onChange={e => setNewPass(e.target.value)}
                        placeholder="Nueva contrasena"
                        className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => cambiarPassword(u.id)}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                      >
                        OK
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
