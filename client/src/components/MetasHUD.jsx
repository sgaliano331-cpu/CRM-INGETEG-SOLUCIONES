import { useEffect, useState } from 'react';
import api from '../api/axios';

function ProgressBar({ value, max, color }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div
        className={`h-full rounded-full progress-bar-fill ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function fmt(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export default function MetasHUD() {
  const [metas, setMetas] = useState(null);

  useEffect(() => {
    api.get('/dashboard/metas-asesora').then(({ data }) => setMetas(data)).catch(() => {});
    const interval = setInterval(() => {
      api.get('/dashboard/metas-asesora').then(({ data }) => setMetas(data)).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!metas) return null;

  const { metaMensual, metaSemanal } = metas;
  const pctMes = metaMensual.meta > 0 ? (metaMensual.ejecutado / metaMensual.meta) * 100 : 0;
  const pctSem = metaSemanal.meta > 0 ? (metaSemanal.ejecutado / metaSemanal.meta) * 100 : 0;

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center gap-8 w-full">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Meta Mensual</span>
          <span className="text-xs font-semibold text-slate-700">
            {fmt(metaMensual.ejecutado)}
            <span className="text-slate-400 font-normal"> / {fmt(metaMensual.meta)}</span>
          </span>
        </div>
        <ProgressBar
          value={metaMensual.ejecutado}
          max={metaMensual.meta}
          color={pctMes >= 100 ? 'bg-emerald-500' : pctMes >= 70 ? 'bg-emerald-600' : 'bg-amber-500'}
        />
        <p className="text-[10px] font-medium text-right mt-1 text-slate-400">{pctMes.toFixed(1)}%</p>
      </div>

      <div className="w-px h-8 bg-slate-200 self-center" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Meta Semanal</span>
          <span className="text-xs font-semibold text-slate-700">
            {fmt(metaSemanal.ejecutado)}
            <span className="text-slate-400 font-normal"> / {fmt(metaSemanal.meta)}</span>
          </span>
        </div>
        <ProgressBar
          value={metaSemanal.ejecutado}
          max={metaSemanal.meta}
          color={pctSem >= 100 ? 'bg-emerald-500' : pctSem >= 70 ? 'bg-emerald-600' : 'bg-amber-500'}
        />
        <p className="text-[10px] font-medium text-right mt-1 text-slate-400">{pctSem.toFixed(1)}%</p>
      </div>
    </div>
  );
}
