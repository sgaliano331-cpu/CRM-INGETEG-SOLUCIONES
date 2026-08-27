import { useState } from 'react';
import api from '../api/axios';

const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const ITEM_VACIO = { concepto: '', subtitulo: '', descripcion: '', cantidad: 1, valor: '' };

export default function GenerarCotizacion() {
  const [idInstalacion, setIdInstalacion] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([{ ...ITEM_VACIO, concepto: 'Instalacion', subtitulo: 'Instalacion de aire acondicionado', descripcion: 'Mano de obra e instalacion de aire acondicionado' }]);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [historial, setHistorial] = useState([]);
  const [showHistorial, setShowHistorial] = useState(false);

  const total = items.reduce((s, i) => s + (parseFloat(i.valor) || 0) * (parseInt(i.cantidad) || 1), 0);

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const addItem = () => setItems(prev => [...prev, { ...ITEM_VACIO }]);

  const removeItem = (idx) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const formatFecha = (isoDate) => {
    const [y, m, d] = isoDate.split('-');
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
  };

  const generar = async () => {
    if (!clienteNombre.trim()) { setMensaje('El nombre del cliente es obligatorio'); return; }
    if (items.some(i => !i.concepto.trim() || !i.valor)) { setMensaje('Todos los items deben tener concepto y valor'); return; }

    setGenerando(true);
    setMensaje('');
    try {
      const token = localStorage.getItem('crm_token');
      const response = await fetch(`${api.defaults.baseURL}/cotizacion-pdf/generar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id_instalacion: idInstalacion,
          cliente_nombre: clienteNombre.trim(),
          telefono: telefono.trim(),
          fecha: formatFecha(fecha),
          items: items.map(i => ({ ...i, valor: parseFloat(i.valor) || 0, cantidad: parseInt(i.cantidad) || 1 })),
        }),
      });

      if (!response.ok) throw new Error('Error generando PDF');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

      await api.post('/cotizacion-pdf/guardar', {
        id_instalacion: idInstalacion,
        cliente_nombre: clienteNombre.trim(),
        telefono: telefono.trim(),
        fecha: formatFecha(fecha),
        items: items.map(i => ({ ...i, valor: parseFloat(i.valor) || 0, cantidad: parseInt(i.cantidad) || 1 })),
        total,
      }).catch(() => {});

      setMensaje('OK Cotizacion generada correctamente');
    } catch (err) {
      setMensaje(err.message || 'Error generando cotizacion');
    } finally {
      setGenerando(false);
    }
  };

  const cargarHistorial = async () => {
    if (showHistorial) { setShowHistorial(false); return; }
    try {
      const { data } = await api.get('/cotizacion-pdf/historial');
      setHistorial(data || []);
    } catch { setHistorial([]); }
    setShowHistorial(true);
  };

  const cargarDesdeHistorial = (h) => {
    setIdInstalacion(h.id_instalacion || '');
    setClienteNombre(h.cliente_nombre || '');
    setTelefono(h.telefono || '');
    const its = typeof h.items === 'string' ? JSON.parse(h.items) : h.items;
    if (Array.isArray(its) && its.length > 0) setItems(its);
    setShowHistorial(false);
    setMensaje('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Generar Cotizacion</h1>
          <p className="text-slate-500 text-sm mt-0.5">Crea cotizaciones PDF profesionales para clientes</p>
        </div>
        <button onClick={cargarHistorial}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
          {showHistorial ? 'Ocultar historial' : 'Ver historial'}
        </button>
      </div>

      {showHistorial && (
        <div className="card space-y-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cotizaciones recientes</h3>
          {historial.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No hay cotizaciones guardadas</p>
          ) : historial.map(h => (
            <div key={h.id} onClick={() => cargarDesdeHistorial(h)}
              className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
              <div>
                <p className="text-sm font-semibold text-slate-800">{h.cliente_nombre}</p>
                <p className="text-[10px] text-slate-400">
                  {h.id_instalacion && <>ID: {h.id_instalacion} &middot; </>}
                  {h.telefono && <>{h.telefono} &middot; </>}
                  {h.fecha}
                </p>
              </div>
              <p className="text-sm font-bold text-emerald-700">{fmt(h.total)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card space-y-4">
        <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Datos del cliente</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Nombre del cliente <span className="text-red-500">*</span></label>
            <input type="text" className="input-field" placeholder="Nombre completo..."
              value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">ID Instalacion</label>
            <input type="text" className="input-field" placeholder="9415..."
              value={idInstalacion} onChange={e => setIdInstalacion(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Telefono</label>
            <input type="text" className="input-field" placeholder="300..."
              value={telefono} onChange={e => setTelefono(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha</label>
            <input type="date" className="input-field" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Items de la cotizacion</h3>
          <button onClick={addItem}
            className="px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Agregar item
          </button>
        </div>

        {items.map((item, idx) => (
          <div key={idx} className="relative p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-3">
            {items.length > 1 && (
              <button onClick={() => removeItem(idx)}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Item {idx + 1}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Concepto <span className="text-red-500">*</span></label>
                <input type="text" className="input-field" placeholder="Ej: Instalacion"
                  value={item.concepto} onChange={e => updateItem(idx, 'concepto', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Subtitulo</label>
                <input type="text" className="input-field" placeholder="Ej: Instalacion de aire acondicionado"
                  value={item.subtitulo} onChange={e => updateItem(idx, 'subtitulo', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Descripcion</label>
                <input type="text" className="input-field" placeholder="Descripcion detallada del concepto..."
                  value={item.descripcion} onChange={e => updateItem(idx, 'descripcion', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cantidad</label>
                <input type="number" className="input-field" min="1"
                  value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Valor (COP) <span className="text-red-500">*</span></label>
                <input type="number" className="input-field" placeholder="320000"
                  value={item.valor} onChange={e => updateItem(idx, 'valor', e.target.value)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Total cotizacion</p>
            <p className="text-2xl font-bold text-emerald-700">{fmt(total)}</p>
          </div>
          <button onClick={generar} disabled={generando}
            className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-2">
            {generando ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generar PDF
              </>
            )}
          </button>
        </div>
      </div>

      {mensaje && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${mensaje.startsWith('OK') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {mensaje.startsWith('OK') ? mensaje.slice(3) : mensaje}
        </div>
      )}
    </div>
  );
}
