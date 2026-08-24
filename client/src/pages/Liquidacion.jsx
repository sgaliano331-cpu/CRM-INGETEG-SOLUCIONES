import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

export default function Liquidacion() {
  const [tab, setTab] = useState('informe');
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoSel, setTecnicoSel] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [informe, setInforme] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tarifas, setTarifas] = useState([]);
  const [items, setItems] = useState({ equipos: [], repuestos: [] });
  const [newTarifa, setNewTarifa] = useState({ tipo: 'equipo', nombre: '', valor_tecnico: '' });
  const [comboEquipos, setComboEquipos] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    api.get('/liquidacion/tecnicos').then(({ data }) => setTecnicos(data)).catch(() => {});
    api.get('/liquidacion/items').then(({ data }) => setItems(data)).catch(() => {});
    fetchTarifas();
  }, []);

  const fetchTarifas = () => {
    api.get('/liquidacion/tarifas').then(({ data }) => setTarifas(data)).catch(() => {});
  };

  const generarInforme = useCallback(async () => {
    if (!tecnicoSel) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ tecnico: tecnicoSel });
      if (desde) params.append('desde', desde);
      if (hasta) params.append('hasta', hasta);
      const { data } = await api.get(`/liquidacion/informe?${params}`);
      setInforme(data);
      setSelected(new Set());
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    } finally {
      setLoading(false);
    }
  }, [tecnicoSel, desde, hasta]);

  const guardarTarifa = async (e) => {
    e.preventDefault();
    const payload = { ...newTarifa };
    if (newTarifa.tipo === 'combo') {
      if (comboEquipos.length < 2) return alert('Selecciona al menos 2 equipos para la combinacion');
      payload.nombre = comboEquipos.sort().join(' + ');
    }
    try {
      await api.post('/liquidacion/tarifas', payload);
      setNewTarifa({ tipo: 'equipo', nombre: '', valor_tecnico: '' });
      setComboEquipos([]);
      fetchTarifas();
      flash('Tarifa guardada');
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    }
  };

  const updateTarifa = async (id) => {
    try {
      await api.put(`/liquidacion/tarifas/${id}`, { valor_tecnico: editVal });
      setEditId(null);
      fetchTarifas();
      flash('Tarifa actualizada');
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    }
  };

  const deleteTarifa = async (id) => {
    try {
      await api.delete(`/liquidacion/tarifas/${id}`);
      fetchTarifas();
      flash('Tarifa eliminada');
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    }
  };

  const marcarLiquidados = async () => {
    if (selected.size === 0) return;
    try {
      await api.put('/liquidacion/marcar-liquidado', { ids: [...selected] });
      flash(`${selected.size} servicios marcados como liquidados`);
      generarInforme();
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    }
  };

  const flash = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  };

  const toggleAll = () => {
    if (!informe) return;
    const pending = informe.servicios.filter(s => !s.liquidado).map(s => s.id);
    if (selected.size === pending.length) setSelected(new Set());
    else setSelected(new Set(pending));
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportarExcel = () => {
    if (!informe || informe.servicios.length === 0) return;
    let csv = '﻿';
    csv += 'Fecha,Cliente,Equipos,Mano Obra Cobrada,Honorario Equipos,Repuestos,Honorario Repuestos,Total Tecnico,Liquidado\n';
    for (const s of informe.servicios) {
      const reps = s.repuestos.map(r => `${r.nombre} x${r.cantidad}`).join(' | ');
      csv += `${s.fecha},"${s.cliente}","${s.equipos}",${s.mano_obra_cobrada},${s.honorario_equipos},"${reps}",${s.honorario_repuestos},${s.total_tecnico},${s.liquidado ? 'Si' : 'No'}\n`;
    }
    const totEq = informe.servicios.reduce((s, x) => s + x.honorario_equipos, 0);
    const totRep = informe.servicios.reduce((s, x) => s + x.honorario_repuestos, 0);
    const totGen = informe.servicios.reduce((s, x) => s + x.total_tecnico, 0);
    const totMO = informe.servicios.reduce((s, x) => s + x.mano_obra_cobrada, 0);
    csv += `TOTALES,,,,${totEq},,${totRep},${totGen},\n`;
    csv += `\nTotal Mano Obra Cobrada,${totMO}\n`;
    csv += `Total Honorarios Equipos,${totEq}\n`;
    csv += `Total Honorarios Repuestos,${totRep}\n`;
    csv += `TOTAL A PAGAR TECNICO,${totGen}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Liquidacion_${tecnicoSel.replace(/ /g, '_')}_${desde || 'todo'}_${hasta || 'todo'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalEquipos = informe?.servicios.reduce((s, x) => s + x.honorario_equipos, 0) || 0;
  const totalRepuestos = informe?.servicios.reduce((s, x) => s + x.honorario_repuestos, 0) || 0;
  const totalGeneral = informe?.servicios.reduce((s, x) => s + x.total_tecnico, 0) || 0;
  const totalMO = informe?.servicios.reduce((s, x) => s + x.mano_obra_cobrada, 0) || 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Liquidacion de Tecnicos</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('informe')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'informe' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Informe
          </button>
          <button onClick={() => setTab('tarifas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'tarifas' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Tarifas
          </button>
        </div>
      </div>

      {msg && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{msg}</div>}

      {tab === 'tarifas' && (
        <div>
          <form onSubmit={guardarTarifa} className="mb-6 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-700 mb-4">Agregar Tarifa</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                <select value={newTarifa.tipo} onChange={e => { setNewTarifa(t => ({ ...t, tipo: e.target.value, nombre: '' })); setComboEquipos([]); }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="equipo">Equipo (mano de obra)</option>
                  <option value="repuesto">Repuesto</option>
                  <option value="combo">Combinacion de equipos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {newTarifa.tipo === 'combo' ? 'Equipos (selecciona 2 o mas)' : 'Nombre'}
                </label>
                {newTarifa.tipo === 'combo' ? (
                  <div className="flex flex-wrap gap-2 p-2 border border-slate-300 rounded-lg min-h-[38px]">
                    {items.equipos.map(eq => (
                      <label key={eq} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${comboEquipos.includes(eq) ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'}`}>
                        <input type="checkbox" className="sr-only" checked={comboEquipos.includes(eq)}
                          onChange={e => setComboEquipos(prev => e.target.checked ? [...prev, eq] : prev.filter(x => x !== eq))} />
                        {eq}
                      </label>
                    ))}
                  </div>
                ) : (
                  <select value={newTarifa.nombre} onChange={e => setNewTarifa(t => ({ ...t, nombre: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" required>
                    <option value="">Seleccionar...</option>
                    {(newTarifa.tipo === 'equipo' ? items.equipos : items.repuestos)
                      .filter(name => !tarifas.some(t => t.tipo === newTarifa.tipo && t.nombre.toLowerCase() === name.toLowerCase()))
                      .map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Valor tecnico ($)</label>
                <div className="flex gap-2">
                  <input type="number" value={newTarifa.valor_tecnico} onChange={e => setNewTarifa(t => ({ ...t, valor_tecnico: e.target.value }))}
                    placeholder="0" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" required />
                  <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Guardar</button>
                </div>
              </div>
            </div>
          </form>

          <div className="grid grid-cols-2 gap-6">
            {/* Tarifas por equipo */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                <h3 className="text-sm font-semibold text-blue-800">Tarifas por Equipo (Mano de Obra)</h3>
                <p className="text-xs text-blue-600 mt-0.5">Cuanto gana el tecnico por mantenimiento de cada equipo</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-2 px-4 text-xs font-semibold text-slate-500">Equipo</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-slate-500">Valor Tecnico</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {tarifas.filter(t => t.tipo === 'equipo').map(t => (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 px-4 text-sm text-slate-700">{t.nombre}</td>
                      <td className="py-2 px-4 text-right">
                        {editId === t.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                              className="w-24 px-2 py-1 border border-slate-300 rounded text-xs text-right" autoFocus />
                            <button onClick={() => updateTarifa(t.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">OK</button>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-emerald-700 cursor-pointer" onClick={() => { setEditId(t.id); setEditVal(t.valor_tecnico); }}>
                            {fmt(t.valor_tecnico)}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-center">
                        <button onClick={() => deleteTarifa(t.id)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                  {tarifas.filter(t => t.tipo === 'equipo').length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-sm text-slate-400">No hay tarifas de equipo configuradas</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Tarifas por repuesto */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                <h3 className="text-sm font-semibold text-amber-800">Tarifas por Repuesto</h3>
                <p className="text-xs text-amber-600 mt-0.5">Cuanto gana el tecnico por cada repuesto instalado</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-2 px-4 text-xs font-semibold text-slate-500">Repuesto</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-slate-500">Valor Tecnico</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {tarifas.filter(t => t.tipo === 'repuesto').map(t => (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 px-4 text-sm text-slate-700">{t.nombre}</td>
                      <td className="py-2 px-4 text-right">
                        {editId === t.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                              className="w-24 px-2 py-1 border border-slate-300 rounded text-xs text-right" autoFocus />
                            <button onClick={() => updateTarifa(t.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">OK</button>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-amber-700 cursor-pointer" onClick={() => { setEditId(t.id); setEditVal(t.valor_tecnico); }}>
                            {fmt(t.valor_tecnico)}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-center">
                        <button onClick={() => deleteTarifa(t.id)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                  {tarifas.filter(t => t.tipo === 'repuesto').length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-sm text-slate-400">No hay tarifas de repuesto configuradas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tarifas combo */}
          {tarifas.some(t => t.tipo === 'combo') && (
            <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
                <h3 className="text-sm font-semibold text-purple-800">Tarifas por Combinacion</h3>
                <p className="text-xs text-purple-600 mt-0.5">Tarifa especial cuando el servicio tiene esta combinacion de equipos</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-2 px-4 text-xs font-semibold text-slate-500">Combinacion</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-slate-500">Valor Tecnico</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {tarifas.filter(t => t.tipo === 'combo').map(t => (
                    <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 px-4 text-sm text-slate-700">
                        {t.nombre.split('+').map((eq, i) => (
                          <span key={i}>
                            {i > 0 && <span className="text-purple-400 mx-1">+</span>}
                            <span className="bg-purple-50 px-1.5 py-0.5 rounded text-purple-700">{eq.trim()}</span>
                          </span>
                        ))}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {editId === t.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                              className="w-24 px-2 py-1 border border-slate-300 rounded text-xs text-right" autoFocus />
                            <button onClick={() => updateTarifa(t.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">OK</button>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-purple-700 cursor-pointer" onClick={() => { setEditId(t.id); setEditVal(t.valor_tecnico); }}>
                            {fmt(t.valor_tecnico)}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-center">
                        <button onClick={() => deleteTarifa(t.id)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'informe' && (
        <div>
          {/* Filtros */}
          <div className="mb-6 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tecnico</label>
                <select value={tecnicoSel} onChange={e => setTecnicoSel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500">
                  <option value="">Seleccionar...</option>
                  {tecnicos.map(t => (
                    <option key={t.tecnico} value={t.tecnico}>{t.tecnico} ({t.cumplidos} cumplidos)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={generarInforme} disabled={!tecnicoSel || loading}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {loading ? 'Cargando...' : 'Generar'}
                </button>
                {informe && informe.servicios.length > 0 && (
                  <button onClick={exportarExcel}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700" title="Exportar CSV">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {informe && informe.servicios.length > 0 && (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <p className="text-xs text-slate-500">Servicios Cumplidos</p>
                  <p className="text-2xl font-bold text-slate-800">{informe.servicios.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <p className="text-xs text-slate-500">Total Mano de Obra Cobrada</p>
                  <p className="text-2xl font-bold text-slate-800">{fmt(totalMO)}</p>
                </div>
                <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4 bg-blue-50">
                  <p className="text-xs text-blue-600">Honorarios Equipos</p>
                  <p className="text-2xl font-bold text-blue-800">{fmt(totalEquipos)}</p>
                </div>
                <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4 bg-amber-50">
                  <p className="text-xs text-amber-600">Honorarios Repuestos</p>
                  <p className="text-2xl font-bold text-amber-800">{fmt(totalRepuestos)}</p>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-700">TOTAL A PAGAR A <strong>{tecnicoSel}</strong></p>
                  <p className="text-3xl font-bold text-emerald-800">{fmt(totalGeneral)}</p>
                </div>
                {selected.size > 0 && (
                  <button onClick={marcarLiquidados}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                    Marcar {selected.size} como Liquidados
                  </button>
                )}
              </div>

              {/* Tabla detallada */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-2.5 px-3 text-left w-8">
                        <input type="checkbox" checked={selected.size > 0 && selected.size === informe.servicios.filter(s => !s.liquidado).length}
                          onChange={toggleAll} className="rounded" />
                      </th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500">Fecha</th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500">Cliente</th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500">Equipos</th>
                      <th className="py-2.5 px-3 text-right text-xs font-semibold text-slate-500">MO Cobrada</th>
                      <th className="py-2.5 px-3 text-right text-xs font-semibold text-blue-600">Hon. Equipos</th>
                      <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500">Repuestos</th>
                      <th className="py-2.5 px-3 text-right text-xs font-semibold text-amber-600">Hon. Repuestos</th>
                      <th className="py-2.5 px-3 text-right text-xs font-semibold text-emerald-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {informe.servicios.map((s, i) => (
                      <tr key={s.id} className={`border-b border-slate-100 hover:bg-slate-50 ${s.liquidado ? 'opacity-50 bg-green-50/30' : ''}`}>
                        <td className="py-2.5 px-3">
                          {!s.liquidado ? (
                            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} className="rounded" />
                          ) : (
                            <span className="text-green-500 text-xs" title="Liquidado">&#10003;</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{s.fecha}</td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">{s.cliente}</td>
                        <td className="py-2.5 px-3">
                          {s.equipos_desglose.map((eq, j) => (
                            <div key={j} className="flex items-center gap-1">
                              {eq.esCombo ? (
                                <>
                                  <span className="text-purple-700 font-medium text-xs">{eq.nombre}</span>
                                  <span className="text-xs text-purple-600 font-semibold">({fmt(eq.tarifa)})</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-slate-700">{eq.nombre}</span>
                                  {eq.tarifa > 0 && <span className="text-xs text-blue-600">({fmt(eq.tarifa)})</span>}
                                  {eq.tarifa === 0 && !s.equipos_desglose.some(e => e.esCombo) && <span className="text-xs text-red-400">(sin tarifa)</span>}
                                </>
                              )}
                            </div>
                          ))}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">{fmt(s.mano_obra_cobrada)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-blue-700">{fmt(s.honorario_equipos)}</td>
                        <td className="py-2.5 px-3">
                          {s.repuestos.length === 0 ? (
                            <span className="text-xs text-slate-400">Sin repuestos</span>
                          ) : s.repuestos.map((r, j) => (
                            <div key={j} className="text-xs">
                              <span className="text-slate-700">{r.nombre} x{r.cantidad}</span>
                              {r.tarifa_tecnico > 0 ? (
                                <span className="text-amber-600 ml-1">({fmt(r.total_tecnico)})</span>
                              ) : (
                                <span className="text-red-400 ml-1">(sin tarifa)</span>
                              )}
                            </div>
                          ))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-amber-700">{fmt(s.honorario_repuestos)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{fmt(s.total_tecnico)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300">
                      <td colSpan={4} className="py-3 px-3 text-right text-sm font-bold text-slate-600">TOTALES</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800">{fmt(totalMO)}</td>
                      <td className="py-3 px-3 text-right font-bold text-blue-800">{fmt(totalEquipos)}</td>
                      <td className="py-3 px-3"></td>
                      <td className="py-3 px-3 text-right font-bold text-amber-800">{fmt(totalRepuestos)}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-800 text-lg">{fmt(totalGeneral)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {informe && informe.servicios.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <p className="text-slate-400">No hay servicios cumplidos para este tecnico en el periodo seleccionado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
