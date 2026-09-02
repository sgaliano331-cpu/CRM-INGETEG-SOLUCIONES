import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';

function formatPhone(phone) {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('57') && clean.length === 12) {
    return `+57 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  return phone;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function WhatsApp() {
  const [tab, setTab] = useState('inbox');
  const [conversaciones, setConversaciones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [masivo, setMasivo] = useState({ plantilla: 'hello_world', telefonos: '', enviando: false, resultado: null });
  const [envioDirecto, setEnvioDirecto] = useState({ telefono: '', mensaje: '', enviando: false });
  const [plantilla, setPlantilla] = useState({
    telefono: '',
    nombre: 'certificaciones2026',
    params: { fecha: '', direccion: '' },
    enviando: false,
    resultado: null,
  });
  const chatRef = useRef(null);
  const pollRef = useRef(null);

  const fetchConversaciones = useCallback(() => {
    api.get('/whatsapp/conversaciones')
      .then(({ data }) => { setConversaciones(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchConversaciones();
    pollRef.current = setInterval(fetchConversaciones, 15000);
    return () => clearInterval(pollRef.current);
  }, [fetchConversaciones]);

  const selectConversacion = async (conv) => {
    setSelected(conv);
    setTab('inbox');
    try {
      const { data } = await api.get(`/whatsapp/mensajes?telefono=${conv.telefono}&limit=100`);
      setMensajes(data.reverse());
      await api.put(`/whatsapp/marcar-leido/${conv.telefono}`);
      fetchConversaciones();
      setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
    } catch {}
  };

  const enviarMensaje = async (e) => {
    e.preventDefault();
    if (!texto.trim() || !selected) return;
    setSending(true);
    try {
      await api.post('/whatsapp/enviar', { telefono: selected.telefono, mensaje: texto });
      setTexto('');
      const { data } = await api.get(`/whatsapp/mensajes?telefono=${selected.telefono}&limit=100`);
      setMensajes(data.reverse());
      setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar');
    } finally {
      setSending(false);
    }
  };

  const enviarDirecto = async (e) => {
    e.preventDefault();
    if (!envioDirecto.telefono || !envioDirecto.mensaje) return;
    setEnvioDirecto(d => ({ ...d, enviando: true }));
    try {
      await api.post('/whatsapp/enviar', { telefono: envioDirecto.telefono, mensaje: envioDirecto.mensaje });
      setEnvioDirecto({ telefono: '', mensaje: '', enviando: false });
      fetchConversaciones();
      alert('Mensaje enviado');
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar');
      setEnvioDirecto(d => ({ ...d, enviando: false }));
    }
  };

  const enviarMasivo = async (e) => {
    e.preventDefault();
    const nums = masivo.telefonos.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);
    if (nums.length === 0) return alert('Agrega al menos un numero');
    setMasivo(m => ({ ...m, enviando: true, resultado: null }));
    try {
      const { data } = await api.post('/whatsapp/enviar-masivo', {
        telefonos: nums,
        plantilla: masivo.plantilla,
      });
      setMasivo(m => ({ ...m, enviando: false, resultado: data }));
      fetchConversaciones();
    } catch (err) {
      alert(err.response?.data?.error || 'Error en envio masivo');
      setMasivo(m => ({ ...m, enviando: false }));
    }
  };

  const enviarPlantilla = async (e) => {
    e.preventDefault();
    if (!plantilla.telefono || !plantilla.nombre) return;
    setPlantilla(p => ({ ...p, enviando: true, resultado: null }));
    try {
      const components = [];
      const paramValues = Object.values(plantilla.params).filter(v => v.trim());
      if (paramValues.length > 0) {
        components.push({
          type: 'body',
          parameters: paramValues.map(v => ({ type: 'text', text: v })),
        });
      }
      await api.post('/whatsapp/enviar', {
        telefono: plantilla.telefono,
        plantilla: plantilla.nombre,
        plantilla_params: components,
      });
      setPlantilla(p => ({
        ...p,
        telefono: '',
        params: { fecha: '', direccion: '' },
        enviando: false,
        resultado: 'ok',
      }));
      fetchConversaciones();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar plantilla');
      setPlantilla(p => ({ ...p, enviando: false }));
    }
  };

  const filteredConvs = conversaciones.filter(c =>
    !search || c.nombre_contacto?.toLowerCase().includes(search.toLowerCase()) || c.telefono?.includes(search)
  );

  const totalNoLeidos = conversaciones.reduce((sum, c) => sum + (parseInt(c.no_leidos) || 0), 0);

  let msgGroups = [];
  let lastDate = '';
  for (const m of mensajes) {
    const d = formatDate(m.creado_en);
    if (d !== lastDate) {
      msgGroups.push({ type: 'date', label: d });
      lastDate = d;
    }
    msgGroups.push({ type: 'msg', ...m });
  }

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col -mt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.214l-.252-.149-2.868.852.852-2.868-.165-.262A7.96 7.96 0 014 12a8 8 0 1116 0 8 8 0 01-8 8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">WhatsApp Business</h1>
            <p className="text-xs text-slate-500">+57 304 366 2186</p>
          </div>
          {totalNoLeidos > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">
              {totalNoLeidos} sin leer
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('inbox')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'inbox' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Bandeja
          </button>
          <button
            onClick={() => setTab('nuevo')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'nuevo' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Nuevo Mensaje
          </button>
          <button
            onClick={() => setTab('plantilla')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'plantilla' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Enviar Plantilla
          </button>
          <button
            onClick={() => setTab('masivo')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'masivo' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Envio Masivo
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === 'inbox' && (
        <div className="flex-1 flex bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
          {/* Lista de conversaciones */}
          <div className="w-[340px] border-r border-slate-200 flex flex-col">
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar conversacion..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm text-slate-400">No hay conversaciones</p>
                  <p className="text-xs text-slate-400 mt-1">Los mensajes entrantes apareceran aqui</p>
                </div>
              ) : (
                filteredConvs.map(c => (
                  <button
                    key={c.telefono}
                    onClick={() => selectConversacion(c)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${selected?.telefono === c.telefono ? 'bg-green-50 border-l-2 border-l-green-500' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-slate-500">
                          {(c.nombre_contacto || c.telefono || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {c.nombre_contacto || formatPhone(c.telefono)}
                          </p>
                          <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                            {timeAgo(c.ultimo_mensaje)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-slate-500 truncate">
                            {c.ultima_direccion === 'saliente' && (
                              <span className="text-slate-400 mr-1">Tu:</span>
                            )}
                            {c.ultimo_texto || '...'}
                          </p>
                          {parseInt(c.no_leidos) > 0 && (
                            <span className="ml-2 min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-green-500 text-white text-[10px] font-bold flex-shrink-0">
                              {c.no_leidos}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col">
            {selected ? (
              <>
                {/* Chat header */}
                <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-green-700">
                      {(selected.nombre_contacto || selected.telefono || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {selected.nombre_contacto || formatPhone(selected.telefono)}
                    </p>
                    <p className="text-xs text-slate-500">{formatPhone(selected.telefono)}</p>
                  </div>
                </div>

                {/* Messages */}
                <div
                  ref={chatRef}
                  className="flex-1 overflow-y-auto px-5 py-4 space-y-1 bg-[#efeae2]"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d5cec6\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
                >
                  {msgGroups.map((item, i) =>
                    item.type === 'date' ? (
                      <div key={`d-${i}`} className="flex justify-center py-2">
                        <span className="px-3 py-1 bg-white/80 rounded-lg text-[11px] text-slate-500 shadow-sm capitalize">
                          {item.label}
                        </span>
                      </div>
                    ) : (
                      <div
                        key={item.id || i}
                        className={`flex ${item.direccion === 'saliente' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] px-3 py-2 rounded-lg shadow-sm text-sm ${
                            item.direccion === 'saliente'
                              ? 'bg-[#d9fdd3] text-slate-800'
                              : 'bg-white text-slate-800'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{item.mensaje}</p>
                          <p className={`text-[10px] mt-1 text-right ${item.direccion === 'saliente' ? 'text-green-700/60' : 'text-slate-400'}`}>
                            {formatTime(item.creado_en)}
                            {item.direccion === 'saliente' && (
                              <svg className="inline-block w-3.5 h-3.5 ml-0.5 -mt-0.5 text-blue-500" viewBox="0 0 16 15" fill="currentColor">
                                <path d="M15.01 3.316l-.478-.372a.365.365 0 00-.51.063L8.666 9.88 5.64 6.854a.365.365 0 00-.516 0l-.445.445a.365.365 0 000 .516l3.64 3.64a.365.365 0 00.516 0l6.21-7.63a.365.365 0 00-.036-.509zm-2.539.145l-.478-.372a.365.365 0 00-.51.063L6.127 9.88 3.1 6.854a.365.365 0 00-.516 0l-.445.445a.365.365 0 000 .516l3.64 3.64a.365.365 0 00.516 0l6.21-7.63a.365.365 0 00-.036-.509z" />
                              </svg>
                            )}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                  {mensajes.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-slate-400">No hay mensajes en esta conversacion</p>
                    </div>
                  )}
                </div>

                {/* Input */}
                <form onSubmit={enviarMensaje} className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
                  <input
                    type="text"
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <button
                    type="submit"
                    disabled={sending || !texto.trim()}
                    className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-[#f0ebe3]">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700">WhatsApp Business</h3>
                  <p className="text-sm text-slate-500 mt-1">Selecciona una conversacion para empezar</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nuevo Mensaje */}
      {tab === 'nuevo' && (
        <div className="flex-1 flex items-start justify-center pt-8">
          <form onSubmit={enviarDirecto} className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Enviar Mensaje Directo</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Numero de telefono</label>
                <input
                  type="text"
                  value={envioDirecto.telefono}
                  onChange={e => setEnvioDirecto(d => ({ ...d, telefono: e.target.value }))}
                  placeholder="3001234567"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">Sin espacios ni guiones. Se agrega +57 automaticamente.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mensaje</label>
                <textarea
                  value={envioDirecto.mensaje}
                  onChange={e => setEnvioDirecto(d => ({ ...d, mensaje: e.target.value }))}
                  placeholder="Escribe tu mensaje..."
                  rows={4}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">Solo puedes enviar texto libre si el cliente te escribio en las ultimas 24h. De lo contrario usa Enviar Plantilla.</p>
              </div>
              <button
                type="submit"
                disabled={envioDirecto.enviando}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {envioDirecto.enviando ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                    Enviar Mensaje
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Envio Masivo */}
      {tab === 'masivo' && (
        <div className="flex-1 flex items-start justify-center pt-8">
          <form onSubmit={enviarMasivo} className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Envio Masivo con Plantilla</h2>
            <p className="text-xs text-slate-500 mb-4">Envia mensajes de plantilla aprobada a multiples numeros. Costo: ~$46 COP por conversacion de marketing.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de plantilla</label>
                <input
                  type="text"
                  value={masivo.plantilla}
                  onChange={e => setMasivo(m => ({ ...m, plantilla: e.target.value }))}
                  placeholder="hello_world"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">Debe ser una plantilla aprobada en Meta Business.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Numeros de telefono</label>
                <textarea
                  value={masivo.telefonos}
                  onChange={e => setMasivo(m => ({ ...m, telefonos: e.target.value }))}
                  placeholder={"3001234567\n3109876543\n3201112233"}
                  rows={6}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Un numero por linea, o separados por coma.
                  {masivo.telefonos && (
                    <span className="text-green-600 font-medium ml-1">
                      {masivo.telefonos.split(/[\n,;]+/).filter(t => t.trim()).length} numeros
                    </span>
                  )}
                </p>
              </div>
              <button
                type="submit"
                disabled={masivo.enviando}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {masivo.enviando ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                    </svg>
                    Enviar a Todos
                  </>
                )}
              </button>

              {masivo.resultado && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Resultado del envio</h3>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-slate-600">Enviados: <strong className="text-green-700">{masivo.resultado.enviados}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-slate-600">Fallidos: <strong className="text-red-600">{masivo.resultado.fallidos}</strong></span>
                    </div>
                  </div>
                  {masivo.resultado.errores?.length > 0 && (
                    <div className="mt-2 text-xs text-red-500 space-y-0.5">
                      {masivo.resultado.errores.slice(0, 5).map((err, i) => (
                        <p key={i}>{err.telefono}: {err.error}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Enviar Plantilla Individual */}
      {tab === 'plantilla' && (
        <div className="flex-1 flex items-start justify-center pt-8">
          <form onSubmit={enviarPlantilla} className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Enviar Plantilla Individual</h2>
            <p className="text-xs text-slate-500 mb-4">Envia un mensaje de plantilla con datos personalizados a un numero especifico.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Numero de telefono</label>
                <input
                  type="text"
                  value={plantilla.telefono}
                  onChange={e => setPlantilla(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="3001234567"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">Sin espacios ni guiones. Se agrega +57 automaticamente.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de plantilla</label>
                <select
                  value={plantilla.nombre}
                  onChange={e => setPlantilla(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                >
                  <option value="certificaciones2026">certificaciones2026</option>
                  <option value="hello_world">hello_world</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Selecciona la plantilla aprobada en Meta Business.</p>
              </div>

              {plantilla.nombre === 'certificaciones2026' && (
                <>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs font-medium text-green-800 mb-2">Parametros de la plantilla:</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Fecha (variable 1)</label>
                        <input
                          type="text"
                          value={plantilla.params.fecha}
                          onChange={e => setPlantilla(p => ({ ...p, params: { ...p.params, fecha: e.target.value } }))}
                          placeholder="Ej: 15 de septiembre de 2026"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Direccion (variable 2)</label>
                        <input
                          type="text"
                          value={plantilla.params.direccion}
                          onChange={e => setPlantilla(p => ({ ...p, params: { ...p.params, direccion: e.target.value } }))}
                          placeholder="Ej: Calle 49 #50-21"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-slate-500 mb-1">Vista previa del mensaje:</p>
                    <p className="text-sm text-slate-700">
                      Buen dia, le informamos que la certificacion de su red de gas sera realizada el dia{' '}
                      <strong className="text-green-700">{plantilla.params.fecha || '{{fecha}}'}</strong> en la direccion{' '}
                      <strong className="text-green-700">{plantilla.params.direccion || '{{direccion}}'}</strong>.
                      Por favor estar pendiente.
                    </p>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={plantilla.enviando}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {plantilla.enviando ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                    Enviar Plantilla
                  </>
                )}
              </button>

              {plantilla.resultado === 'ok' && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm text-green-700 font-medium">Mensaje de plantilla enviado exitosamente</p>
                </div>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
