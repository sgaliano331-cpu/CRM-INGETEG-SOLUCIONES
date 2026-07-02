import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

const TIPOS = ['Almuerzo', 'Desayuno', 'Pausa Activa'];

const fmtHora = (iso) => {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const fmtDuracion = (min) => {
  if (!min) return '--';
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  const s = Math.round((min % 1) * 60);
  if (h > 0) return `${h}h ${m}m`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export default function Descansos() {
  const [enDescanso, setEnDescanso] = useState(false);
  const [descansoActivo, setDescansoActivo] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [estRes, histRes] = await Promise.all([
        api.get('/descansos/estado'),
        api.get('/descansos/historial'),
      ]);
      setEnDescanso(estRes.data.enDescanso);
      setDescansoActivo(estRes.data.descanso);
      setHistorial(histRes.data.descansos || []);
    } catch {}
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!enDescanso || !descansoActivo) {
      setTiempoTranscurrido(0);
      return;
    }
    const salidaMs = new Date(descansoActivo.salida).getTime();
    const tick = () => setTiempoTranscurrido(Math.floor((Date.now() - salidaMs) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [enDescanso, descansoActivo]);

  const marcarSalida = async (tipo) => {
    setLoading(true);
    setMsg('');
    try {
      await api.post('/descansos/salida', { tipo });
      await cargar();
      setMsg(`Salida a ${tipo} registrada`);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error al registrar salida');
    }
    setLoading(false);
  };

  const marcarEntrada = async () => {
    setLoading(true);
    setMsg('');
    try {
      const { data } = await api.put('/descansos/entrada');
      await cargar();
      setMsg(`Entrada registrada - Duracion: ${fmtDuracion(data.duracion_minutos)}`);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error al registrar entrada');
    }
    setLoading(false);
  };

  const fmtTimer = (seg) => {
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const totalHoy = historial
    .filter(d => d.duracion_minutos)
    .reduce((sum, d) => sum + d.duracion_minutos, 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Descansos</h1>
        <p className="text-slate-500 text-sm mt-0.5">Registra tus tiempos de almuerzo, desayuno y pausas activas</p>
      </div>

      {msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${msg.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {msg}
        </div>
      )}

      {enDescanso && descansoActivo ? (
        <div className="card border-2 border-amber-300 bg-amber-50/50">
          <div className="text-center">
            <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider mb-1">En descanso</p>
            <p className="text-lg font-bold text-slate-800">{descansoActivo.tipo}</p>
            <p className="text-xs text-slate-500 mt-1">Salida: {fmtHora(descansoActivo.salida)}</p>
            <div className="mt-4 mb-4">
              <span className="text-4xl font-mono font-bold text-amber-700">{fmtTimer(tiempoTranscurrido)}</span>
            </div>
            <button
              onClick={marcarEntrada}
              disabled={loading}
              className="w-full py-3 bg-emerald-700 text-white rounded-lg font-semibold text-sm hover:bg-emerald-800 transition-colors disabled:opacity-50"
            >
              Marcar Entrada
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Selecciona el tipo de descanso</h2>
          <div className="grid grid-cols-3 gap-3">
            {TIPOS.map(tipo => (
              <button
                key={tipo}
                onClick={() => marcarSalida(tipo)}
                disabled={loading}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all disabled:opacity-50"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  tipo === 'Almuerzo' ? 'bg-orange-100 text-orange-600' :
                  tipo === 'Desayuno' ? 'bg-blue-100 text-blue-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {tipo === 'Almuerzo' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
                    {tipo === 'Desayuno' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />}
                    {tipo === 'Pausa Activa' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                  </svg>
                </div>
                <span className="text-sm font-semibold text-slate-700">{tipo}</span>
                <span className="text-[10px] text-slate-400">
                  {tipo === 'Almuerzo' ? 'Marca entrada al regresar' : 'Marca salida y entrada'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resumen del dia */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Descansos de Hoy</h2>
          {totalHoy > 0 && (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              Total: {fmtDuracion(totalHoy)}
            </span>
          )}
        </div>

        {historial.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No hay descansos registrados hoy</p>
        ) : (
          <div className="space-y-2">
            {historial.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    d.tipo === 'Almuerzo' ? 'bg-orange-100 text-orange-600' :
                    d.tipo === 'Desayuno' ? 'bg-blue-100 text-blue-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {d.tipo[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.tipo}</p>
                    <p className="text-[11px] text-slate-400">
                      {fmtHora(d.salida)} - {d.entrada ? fmtHora(d.entrada) : 'En curso...'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {d.duracion_minutos ? (
                    <span className="text-sm font-semibold text-slate-700">{fmtDuracion(d.duracion_minutos)}</span>
                  ) : (
                    <span className="text-xs text-amber-600 font-medium animate-pulse">En curso</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
