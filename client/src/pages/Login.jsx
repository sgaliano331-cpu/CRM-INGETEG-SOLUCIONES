import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Error de conexion con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-700/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block bg-white rounded-2xl px-6 py-4 shadow-lg shadow-emerald-900/20 mb-4">
            <img src="/logo-ingeteg.png" alt="INGETEG Soluciones" className="h-16 w-auto mx-auto" />
          </div>
          <p className="text-slate-500 text-sm mt-1">Sistema CRM Comercial</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-7 backdrop-blur-sm">
          <h2 className="text-base font-semibold text-white mb-5">Iniciar Sesion</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Usuario</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Ingresa tu usuario"
                value={form.username}
                onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Contrasena</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="--------"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              id="btn-login"
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2.5 rounded-lg transition-all text-sm flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Ingresando...
                </>
              ) : 'Ingresar al Sistema'}
            </button>
          </form>

          <p className="text-center text-[11px] text-slate-600 mt-5">
            CRM INGETEG &copy; 2024 &mdash; Acceso Restringido
          </p>
        </div>
      </div>
    </div>
  );
}
