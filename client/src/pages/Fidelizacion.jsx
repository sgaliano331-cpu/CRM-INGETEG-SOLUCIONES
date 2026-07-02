import { useEffect, useState } from 'react';
import api from '../api/axios';

const TABS = [
  { key: '3', label: '3 Meses', desc: 'Clientes con servicio cumplido hace ~3 meses (seguimiento preventivo)' },
  { key: '12', label: '1 Ano', desc: 'Clientes con servicio cumplido hace ~1 ano (renovacion de mantenimiento)' },
];

export default function Fidelizacion() {
  const [tab, setTab] = useState('3');
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    api.get(`/clientes/fidelizacion/${tab}`)
      .then(({ data }) => setClientes(data.clientes))
      .catch(() => setClientes([]))
      .finally(() => setCargando(false));
  }, [tab]);

  const tabInfo = TABS.find(t => t.key === tab);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Fidelizacion y Recompra</h1>
        <p className="text-slate-500 text-sm mt-0.5">Clientes automaticos para llamadas de seguimiento y renovacion</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all
              ${tab === t.key ? 'bg-emerald-700 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
        <p className="text-sm text-emerald-800">
          <span className="font-semibold">{tabInfo.label}:</span> {tabInfo.desc}
        </p>
      </div>

      <div className="card">
        {cargando ? (
          <div className="text-center py-8 text-slate-500">Cargando clientes...</div>
        ) : clientes.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>
            </div>
            <p className="text-slate-400 text-sm">No hay clientes para este periodo.</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-400 mb-3 font-medium">{clientes.length} cliente(s) encontrado(s)</p>
            <div className="space-y-2">
              {clientes.map((c, i) => (
                <div key={i} className="flex items-center gap-4 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {c.nombre?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm">{c.nombre}</p>
                    <p className="text-xs text-slate-500">{c.telefono} &middot; {c.ciudad}</p>
                  </div>
                  <div className="text-right text-xs flex-shrink-0">
                    <p className="text-slate-600">{c.equipos}</p>
                    <p className="text-slate-400 mt-0.5">Servicio: {c.fecha_agendamiento}</p>
                  </div>
                  {c.asesora_nombre && (
                    <span className="badge badge-purple">{c.asesora_nombre.split(' ')[0]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
