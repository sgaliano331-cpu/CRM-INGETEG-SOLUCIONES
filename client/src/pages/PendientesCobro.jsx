import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function fmt(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export default function PendientesCobro() {
  const { isCoordinador } = useAuth();
  const [pendientes, setPendientes] = useState([]);
  const [asesoras, setAsesoras] = useState([]);
  const [filtroAsesora, setFiltroAsesora] = useState('');
  const [cargando, setCargando] = useState(true);

  const [subiendoId, setSubiendoId] = useState(null);
  const [comprobante, setComprobante] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (isCoordinador) {
      api.get('/clientes/asesoras/lista').then(({ data }) => setAsesoras(data.asesoras)).catch(() => {});
    }
  }, [isCoordinador]);

  const cargar = () => {
    setCargando(true);
    const url = filtroAsesora
      ? `/llamadas/pendientes-cobro?asesora_id=${filtroAsesora}`
      : '/llamadas/pendientes-cobro';
    api.get(url).then(({ data }) => setPendientes(data.pendientes)).catch(() => {})
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, [filtroAsesora]);

  const handleSubir = async (agId) => {
    if (!comprobante) { setMensaje('Selecciona un archivo'); return; }
    setGuardando(true);
    setMensaje('');
    try {
      const fd = new FormData();
      fd.append('comprobante', comprobante);
      await api.put(`/llamadas/subir-comprobante/${agId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMensaje('OK Comprobante subido correctamente.');
      setSubiendoId(null);
      setComprobante(null);
      setTimeout(() => { setMensaje(''); cargar(); }, 1200);
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al subir comprobante');
    } finally {
      setGuardando(false);
    }
  };

  const totalCOP = pendientes.reduce((acc, p) => acc + (p.costo_cop || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Pendientes por Cobro</h1>
          <p className="text-slate-500 text-sm mt-0.5">Servicios con pago pendiente de gestion de cartera</p>
        </div>
        <div className="card px-4 py-3 text-right">
          <p className="text-[11px] text-slate-400 font-medium">Total pendiente</p>
          <p className="text-lg font-bold text-amber-600">{fmt(totalCOP)}</p>
        </div>
      </div>

      {isCoordinador && (
        <div className="card">
          <label className="label">Filtrar por Asesora</label>
          <select className="input-field max-w-xs" value={filtroAsesora}
            onChange={e => setFiltroAsesora(e.target.value)}>
            <option value="">Todas las asesoras</option>
            {asesoras.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
      )}

      {mensaje && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${mensaje.startsWith('OK') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {mensaje}
        </div>
      )}

      <div className="card">
        {cargando ? (
          <div className="text-center py-8 text-slate-500">Cargando...</div>
        ) : pendientes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">No hay pendientes por cobro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-3">Cliente</th>
                  <th className="text-left py-3 px-3">Telefono</th>
                  <th className="text-left py-3 px-3">Equipos</th>
                  <th className="text-left py-3 px-3">Fecha</th>
                  <th className="text-right py-3 px-3">Costo</th>
                  {isCoordinador && <th className="text-left py-3 px-3">Asesora</th>}
                  <th className="text-center py-3 px-3">Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                    <td className="py-3 px-3">
                      <p className="font-medium text-slate-800">{p.cliente_nombre}</p>
                      <p className="text-xs text-slate-400">{p.ciudad} &mdash; {p.barrio}</p>
                      {p.obs_marcacion && (
                        <div className="mt-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                          <p className="text-[11px] text-blue-700"><span className="font-semibold">Marcacion:</span> {p.obs_marcacion}</p>
                        </div>
                      )}
                      {p.obs_tecnica && (
                        <div className="mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          <p className="text-[11px] text-amber-700"><span className="font-semibold">Tecnico:</span> {p.obs_tecnica}</p>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{p.telefono}</td>
                    <td className="py-3 px-3 text-slate-600">{p.equipos}</td>
                    <td className="py-3 px-3 text-slate-500">{p.fecha_agendamiento}</td>
                    <td className="py-3 px-3 text-right font-semibold text-amber-600">{fmt(p.costo_cop)}</td>
                    {isCoordinador && <td className="py-3 px-3 text-slate-500">{p.asesora_nombre}</td>}
                    <td className="py-3 px-3 text-center">
                      {p.comprobante_pago_url ? (
                        <a href={p.comprobante_pago_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-emerald-700 underline font-medium hover:text-emerald-800">
                          Ver comprobante
                        </a>
                      ) : subiendoId === p.id ? (
                        <div className="space-y-2">
                          <div className={`border-2 border-dashed rounded-lg p-2 transition-all ${comprobante ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                            <input type="file" accept="image/*,application/pdf" id={`comp-${p.id}`}
                              className="hidden" onChange={e => setComprobante(e.target.files[0])} />
                            <label htmlFor={`comp-${p.id}`} className="cursor-pointer text-xs text-slate-500">
                              {comprobante ? comprobante.name : 'Seleccionar archivo'}
                            </label>
                          </div>
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => handleSubir(p.id)} disabled={guardando}
                              className="text-[10px] px-2 py-1 bg-emerald-700 text-white rounded font-medium hover:bg-emerald-800 disabled:opacity-50">
                              {guardando ? 'Subiendo...' : 'Subir'}
                            </button>
                            <button onClick={() => { setSubiendoId(null); setComprobante(null); }}
                              className="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded font-medium hover:bg-slate-200">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setSubiendoId(p.id); setComprobante(null); setMensaje(''); }}
                          className="text-[11px] px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-medium hover:bg-blue-100 transition-all">
                          Subir comprobante
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
