import { useEffect, useState } from 'react';
import api from '../api/axios';

const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const EQUIPOS = [
  'Cubierta', 'Estufas', 'Calentador', 'Horno', 'Campana Extractora',
  'Lavadora', 'Nevera', 'Aire Acondicionado', 'Redes de Gas (Reparacion)',
  'Redes de Gas (Mantenimiento)',
];
const TIPOS_SERVICIO = ['Mantenimiento', 'Reparación', 'Garantía'];
const MOTIVOS_RECHAZO = [
  'No le interesa',
  'No tiene dinero',
  'Ya lo realiza con otra empresa',
  'Tiene una mala experiencia',
  'Número fuera de servicio',
  'No contesta',
  'Usuario se comunica',
  'Se esta gestionando por WhatsApp',
  'Número equivocado',
  'Ya realizo el servicio con Ingeteg',
];
const CIUDADES = [
  'Medellin', 'Bello', 'Itagui', 'Envigado', 'Sabaneta',
  'La Estrella', 'Caldas', 'Copacabana', 'Girardota', 'Barbosa',
];

function Timer({ startTime }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [startTime]);

  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  return (
    <span className={`font-mono text-sm font-semibold ${elapsed > 180 ? 'text-amber-600' : 'text-emerald-600'}`}>
      {m}:{s}
    </span>
  );
}

const estadoBadge = {
  'Agendado': 'badge-blue',
  'Cumplido': 'badge-green',
  'Pendiente por repuesto': 'badge-yellow',
  'Cancelado por el cliente': 'badge-red',
};

const metodoBadge = {
  'Efectivo': 'bg-emerald-100 text-emerald-700',
  'Transferencia': 'bg-blue-100 text-blue-700',
  'Pendiente por cobro': 'bg-amber-100 text-amber-700',
  'Garantía': 'bg-purple-100 text-purple-700',
};

function fmtFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtFechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export default function MisClientes() {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroObjecion, setFiltroObjecion] = useState('');
  const [expandido, setExpandido] = useState(null);

  const [seleccionados, setSeleccionados] = useState(new Set());
  const [waModal, setWaModal] = useState(false);
  const [waTemplates, setWaTemplates] = useState([]);
  const [waTemplate, setWaTemplate] = useState('');
  const [waEnviando, setWaEnviando] = useState(false);
  const [waResultado, setWaResultado] = useState(null);
  const [waCargandoTpl, setWaCargandoTpl] = useState(false);
  const [waPhones, setWaPhones] = useState([]);
  const [waParams, setWaParams] = useState([]);
  const [timerStart, setTimerStart] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editGuardando, setEditGuardando] = useState(false);
  const [editMsg, setEditMsg] = useState('');

  const [formCliente, setFormCliente] = useState(null);
  const [obs, setObs] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [agenda, setAgenda] = useState({ equipos: [], tipo_servicio: 'Mantenimiento', fecha_agendamiento: '', hora_inicio: '', hora_fin: '', costo_cop: '', tecnico: '' });
  const [reprogramar, setReprogramar] = useState(false);
  const [repFecha, setRepFecha] = useState('');
  const [repHora, setRepHora] = useState('');
  const [repMotivo, setRepMotivo] = useState('');
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tecnicos, setTecnicos] = useState([]);

  useEffect(() => {
    api.get('/llamadas/tecnicos').then(({ data }) => setTecnicos(data.tecnicos || [])).catch(() => {});
  }, []);

  const cargar = () => {
    setCargando(true);
    api.get('/llamadas/mis-clientes')
      .then(({ data }) => setClientes(data.clientes || []))
      .catch(() => setClientes([]))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  const filtrados = clientes.filter(c => {
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!c.nombre?.toLowerCase().includes(q) && !c.telefono?.toLowerCase().includes(q) && !c.direccion?.toLowerCase().includes(q) && !c.barrio?.toLowerCase().includes(q)) return false;
    }
    if (filtroEstado) {
      const tieneEstado = c.servicios.some(s => {
        if (filtroEstado === 'Sin agendar') return !s.agendamiento_id;
        return s.estado_servicio === filtroEstado;
      });
      if (!tieneEstado) return false;
    }
    if (filtroObjecion) {
      const tieneObjecion = c.servicios.some(s =>
        s.obs_marcacion && s.obs_marcacion.startsWith(`[${filtroObjecion}]`)
      );
      if (!tieneObjecion) return false;
    }
    return true;
  });

  const abrirForm = (cliente) => {
    setFormCliente(cliente);
    setObs('');
    setAcepto(false);
    setAgenda({ equipos: [], tipo_servicio: 'Mantenimiento', fecha_agendamiento: '', hora_inicio: '', hora_fin: '', costo_cop: '', tecnico: '' });
    setReprogramar(false);
    setRepFecha('');
    setRepHora('');
    setRepMotivo('');
    setMotivoRechazo('');
    setMensaje('');
    setTimerStart(Date.now());
  };

  const cerrarForm = () => {
    setFormCliente(null);
    setMensaje('');
    setTimerStart(null);
  };

  const toggleExpandido = (clienteId, cliente) => {
    if (expandido === clienteId) {
      setExpandido(null);
      setTimerStart(null);
      setEditForm(null);
      setEditMsg('');
      setFormCliente(null);
    } else {
      setExpandido(clienteId);
      setTimerStart(null);
      setEditForm({
        nombre: cliente.nombre || '',
        telefono: cliente.telefono || '',
        direccion: cliente.direccion || '',
        barrio: cliente.barrio || '',
        ciudad: cliente.ciudad || 'Medellin',
      });
      setEditMsg('');
    }
  };

  const handleGuardarEdit = async (clienteId) => {
    setEditGuardando(true);
    setEditMsg('');
    try {
      await api.put(`/clientes/${clienteId}`, editForm);
      setEditMsg('OK Datos actualizados.');
      cargar();
      setTimeout(() => setEditMsg(''), 2000);
    } catch (err) {
      setEditMsg(err.response?.data?.error || 'Error al actualizar');
    } finally {
      setEditGuardando(false);
    }
  };

  const toggleEquipo = (eq) => {
    setAgenda(a => ({
      ...a,
      equipos: a.equipos.includes(eq) ? a.equipos.filter(e => e !== eq) : [...a.equipos, eq],
    }));
  };

  const handleGuardarLlamada = async () => {
    if (!formCliente) return;
    if (!obs.trim()) { setMensaje('Las observaciones son obligatorias.'); return; }
    if (obs.trim().length < 10) { setMensaje('Las observaciones deben tener minimo 10 caracteres.'); return; }
    if (!acepto && !reprogramar && !motivoRechazo) { setMensaje('Selecciona el motivo por el cual no se agenda.'); return; }
    if (acepto && agenda.equipos.length === 0) { setMensaje('Selecciona al menos un equipo.'); return; }
    if (acepto && !agenda.fecha_agendamiento) { setMensaje('La fecha de agendamiento es requerida.'); return; }

    setGuardando(true);
    setMensaje('');
    try {
      await api.put(`/clientes/${formCliente.cliente_id}`, editForm);

      const { data: d } = await api.post('/llamadas/iniciar', { cliente_id: formCliente.cliente_id });
      const hId = d.historial_id;

      const obsFinal = !acepto && !reprogramar && motivoRechazo
        ? `[${motivoRechazo}] ${obs}` : obs;

      await api.post('/llamadas/guardar', {
        historial_id: hId,
        cliente_id: formCliente.cliente_id,
        observaciones: obsFinal,
        acepto_servicio: acepto,
        inicio_llamada: new Date(timerStart).toISOString(),
        ...(acepto && {
          equipos: agenda.equipos.join(', '),
          tipo_servicio: agenda.tipo_servicio,
          fecha_agendamiento: agenda.fecha_agendamiento,
          hora_inicio: agenda.hora_inicio || null,
          hora_fin: agenda.hora_fin || null,
          costo_cop: parseFloat(agenda.costo_cop) || 0,
          tecnico: agenda.tecnico || null,
        }),
      });

      if (reprogramar) {
        if (!repFecha || !repHora) { setMensaje('Fecha y hora de reprogramacion son obligatorias.'); setGuardando(false); return; }
        await api.post('/llamadas/reprogramar', {
          cliente_id: formCliente.cliente_id,
          fecha_reprogramacion: repFecha,
          hora_reprogramacion: repHora,
          motivo: repMotivo.trim() || obs.trim(),
        });
      }

      setMensaje('OK Guardado correctamente.');
      setTimeout(() => { cerrarForm(); cargar(); }, 1200);
    } catch (err) {
      setMensaje(err.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const toggleSeleccion = (clienteId) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(clienteId)) next.delete(clienteId); else next.add(clienteId);
      return next;
    });
  };
  const seleccionarTodos = () => {
    setSeleccionados(seleccionados.size === filtrados.length ? new Set() : new Set(filtrados.map(c => c.cliente_id)));
  };
  const [waClientes, setWaClientes] = useState([]);
  const [waHeaderUrl, setWaHeaderUrl] = useState('');
  const autoFillParams = (paramNames, cliente) => {
    const map = { nombre: cliente.nombre, direccion: cliente.direccion, barrio: cliente.barrio, ciudad: cliente.ciudad, telefono: cliente.telefono };
    return paramNames.map(name => ({ name, value: map[name.toLowerCase()] || '' }));
  };
  const abrirWaModal = (clientesList) => {
    const cls = clientesList || filtrados.filter(c => seleccionados.has(c.cliente_id) && c.telefono);
    if (!cls.length) return;
    setWaClientes(cls); setWaPhones(cls.map(c => c.telefono)); setWaResultado(null); setWaTemplate(''); setWaParams([]); setWaHeaderUrl(''); setWaModal(true);
    if (!waTemplates.length) {
      setWaCargandoTpl(true);
      api.get('/whatsapp/plantillas').then(({ data }) => {
        const all = Array.isArray(data) ? data : data.templates || [];
        setWaTemplates(all.filter(t => t.status === 'APPROVED'));
      }).catch(() => setWaTemplates([])).finally(() => setWaCargandoTpl(false));
    }
  };
  const enviarWhatsApp = async () => {
    if (!waTemplate) return;
    setWaEnviando(true); setWaResultado(null);
    const tpl = waTemplates.find(t => t.name === waTemplate);
    const bodyComp = tpl?.components?.find(c => c.type === 'BODY');
    const paramNames = (bodyComp?.text?.match(/\{\{(\w+)\}\}/g) || []).map(m => m.replace(/[{}]/g, ''));
    const headerComp = tpl?.components?.find(c => c.type === 'HEADER');
    const headerComponents = [];
    if (headerComp?.format === 'IMAGE' && waHeaderUrl.trim()) {
      headerComponents.push({ type: 'header', parameters: [{ type: 'image', image: { link: waHeaderUrl.trim() } }] });
    }
    try {
      if (waClientes.length === 1) {
        const plantilla_params = [];
        if (headerComponents.length) plantilla_params.push(...headerComponents);
        if (waParams.filter(p => p.value.trim()).length > 0) {
          plantilla_params.push({ type: 'body', parameters: waParams.map(p => ({ type: 'text', parameter_name: p.name, text: p.value || 'N/A' })) });
        }
        await api.post('/whatsapp/enviar', { telefono: waPhones[0], plantilla: waTemplate, plantilla_params, idioma: 'es_CO' });
        setWaResultado({ ok: true, msg: 'Mensaje enviado correctamente' });
      } else {
        const contactos = waClientes.map(c => ({
          telefono: c.telefono,
          params: autoFillParams(paramNames, c),
        }));
        const { data } = await api.post('/whatsapp/enviar-masivo', { contactos, plantilla: waTemplate, headerComponents, idioma: 'es_CO' });
        setWaResultado({ ok: true, msg: `Enviados: ${data.enviados} | Fallidos: ${data.fallidos} de ${data.total}` });
      }
    } catch (err) {
      setWaResultado({ ok: false, msg: err.response?.data?.error || 'Error al enviar' });
    } finally { setWaEnviando(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Mis Clientes</h1>
          <p className="text-slate-500 text-sm mt-0.5">Historial completo de servicios por cliente</p>
        </div>
        {seleccionados.size > 0 && (
          <button onClick={() => abrirWaModal()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Enviar WhatsApp ({seleccionados.size})
          </button>
        )}
      </div>

      <div className="card p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex items-center self-center pt-4">
            <input type="checkbox" checked={filtrados.length > 0 && seleccionados.size === filtrados.length}
              onChange={seleccionarTodos} className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer" title="Seleccionar todos" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Buscar cliente</label>
            <input type="text" className="input-field" placeholder="Nombre o telefono..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
            <select className="input-field" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="Agendado">Agendado</option>
              <option value="Cumplido">Cumplido</option>
              <option value="Pendiente por repuesto">Pendiente por repuesto</option>
              <option value="Cancelado por el cliente">Cancelado</option>
              <option value="Sin agendar">Sin agendar</option>
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Objecion</label>
            <select className="input-field" value={filtroObjecion} onChange={e => setFiltroObjecion(e.target.value)}>
              <option value="">Todas las objeciones</option>
              {MOTIVOS_RECHAZO.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">Clientes</span>
            <p className="text-lg font-bold text-slate-800">{filtrados.length}</p>
          </div>
        </div>
      </div>

      {cargando ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 text-sm">Cargando clientes...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-slate-500 text-sm font-medium">No se encontraron clientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(c => {
            const isOpen = expandido === c.cliente_id;
            const totalServicios = c.servicios.filter(s => s.agendamiento_id).length;
            const ultimoServicio = c.servicios.find(s => s.agendamiento_id);

            return (
              <div key={c.cliente_id} className={`rounded-lg border transition-all ${
                isOpen ? 'bg-white border-slate-200 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'
              }`}>
                {/* Header del cliente */}
                <div className="px-4 py-3 cursor-pointer flex items-center gap-2">
                  <input type="checkbox" checked={seleccionados.has(c.cliente_id)}
                    onChange={() => toggleSeleccion(c.cliente_id)}
                    className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer flex-shrink-0"
                    onClick={e => e.stopPropagation()} />
                  <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => toggleExpandido(c.cliente_id, c)}>
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-slate-500">{c.nombre.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">{c.nombre}</p>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-semibold">
                          {totalServicios} servicio{totalServicios !== 1 ? 's' : ''}
                        </span>
                        {ultimoServicio && (
                          <span className={`badge ${estadoBadge[ultimoServicio.estado_servicio] || 'badge-gray'}`}>
                            {ultimoServicio.estado_servicio}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.telefono}
                        {c.direccion && <> &middot; {c.direccion}</>}
                        {c.barrio && <>, {c.barrio}</>}
                        {c.ciudad && <> &middot; {c.ciudad}</>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-slate-400">Ultima llamada</p>
                      <p className="text-xs text-slate-600">{fmtFecha(c.servicios[0]?.inicio_llamada)}</p>
                    </div>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {c.telefono && (
                    <button onClick={e => { e.stopPropagation(); abrirWaModal([c]); }}
                      className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors flex-shrink-0" title="Enviar WhatsApp">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </button>
                  )}
                </div>

                {/* Detalle expandido */}
                {isOpen && editForm && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    {/* Editar informacion del cliente */}
                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/30 p-4">
                      <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Informacion del Cliente
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Nombre Completo</label>
                          <input className="input-field" value={editForm.nombre}
                            onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Telefono</label>
                          <input className="input-field" value={editForm.telefono}
                            onChange={e => setEditForm(f => ({ ...f, telefono: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Direccion</label>
                          <input className="input-field" value={editForm.direccion}
                            onChange={e => setEditForm(f => ({ ...f, direccion: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Barrio</label>
                          <input className="input-field" value={editForm.barrio}
                            onChange={e => setEditForm(f => ({ ...f, barrio: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Ciudad</label>
                          <select className="input-field" value={editForm.ciudad}
                            onChange={e => setEditForm(f => ({ ...f, ciudad: e.target.value }))}>
                            {CIUDADES.map(ci => <option key={ci}>{ci}</option>)}
                          </select>
                        </div>
                        <div className="flex items-end gap-2">
                          <button onClick={() => handleGuardarEdit(c.cliente_id)} disabled={editGuardando}
                            className="btn-primary text-xs px-4">
                            {editGuardando ? 'Guardando...' : 'Guardar Cambios'}
                          </button>
                          {editMsg && (
                            <span className={`text-xs font-medium ${editMsg.startsWith('OK') ? 'text-emerald-600' : 'text-red-600'}`}>
                              {editMsg.replace('OK ', '')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Boton nueva llamada */}
                    <div className="flex justify-end mb-3">
                      <button onClick={() => abrirForm(c)}
                        className="btn-primary text-xs flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Nueva Llamada
                      </button>
                    </div>

                    {/* Panel de nueva llamada (igual a Marcacion) */}
                    {formCliente?.cliente_id === c.cliente_id && (
                      <div className="mb-4 space-y-4">
                        {/* Header con timer */}
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                            Nueva Llamada - {c.nombre}
                          </h4>
                          {timerStart && (
                            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                              <span className="text-[10px] text-slate-500">Tiempo:</span>
                              <Timer startTime={timerStart} />
                            </div>
                          )}
                        </div>

                        {/* Gestion de Llamada */}
                        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
                          <h4 className="text-sm font-semibold text-slate-700">Gestion de Llamada</h4>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5">Observaciones de la llamada <span className="text-red-500">*</span></label>
                            <textarea className="input-field min-h-[100px] resize-none"
                              placeholder="Describe el resultado de la llamada..."
                              value={obs} onChange={e => setObs(e.target.value)} />
                          </div>

                          <div className="flex gap-4">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                              <input type="checkbox" checked={acepto}
                                onChange={() => { setAcepto(a => !a); setReprogramar(false); setMotivoRechazo(''); }}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                              <span className="text-sm text-slate-700 font-medium">Acepto agendar servicio?</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                              <input type="checkbox" checked={reprogramar}
                                onChange={() => { setReprogramar(r => !r); setAcepto(false); setMotivoRechazo(''); }}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                              <span className="text-sm text-slate-700 font-medium">Reprogramar llamada?</span>
                            </label>
                          </div>

                          {!acepto && !reprogramar && (
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1.5">Motivo por el cual no se agenda <span className="text-red-500">*</span></label>
                              <div className="flex flex-wrap gap-2">
                                {MOTIVOS_RECHAZO.map(m => (
                                  <button key={m} type="button"
                                    onClick={() => setMotivoRechazo(motivoRechazo === m ? '' : m)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                                      motivoRechazo === m
                                        ? 'bg-red-600 border-red-600 text-white'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}>{m}</button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Agendamiento */}
                        {acepto && (
                          <div className="rounded-lg border border-emerald-200 bg-white p-4 space-y-4">
                            <h4 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                              </svg>
                              Detalles del Agendamiento
                            </h4>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1.5">Tipo de Equipo(s) <span className="text-red-500">*</span></label>
                              <div className="flex flex-wrap gap-2">
                                {EQUIPOS.map(eq => (
                                  <button key={eq} type="button" onClick={() => toggleEquipo(eq)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                                      agenda.equipos.includes(eq)
                                        ? 'bg-emerald-700 border-emerald-700 text-white'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}>{eq}</button>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Tipo de Servicio</label>
                                <select className="input-field" value={agenda.tipo_servicio}
                                  onChange={e => setAgenda(a => ({ ...a, tipo_servicio: e.target.value }))}>
                                  {TIPOS_SERVICIO.map(t => <option key={t}>{t}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha de Agendamiento <span className="text-red-500">*</span></label>
                                <input type="date" className="input-field" value={agenda.fecha_agendamiento}
                                  onChange={e => setAgenda(a => ({ ...a, fecha_agendamiento: e.target.value }))} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Costo del Servicio (COP)</label>
                                <input type="number" className="input-field" placeholder="0" value={agenda.costo_cop}
                                  onChange={e => setAgenda(a => ({ ...a, costo_cop: e.target.value }))} />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Hora Inicio</label>
                                <input type="time" className="input-field" value={agenda.hora_inicio}
                                  onChange={e => setAgenda(a => ({ ...a, hora_inicio: e.target.value }))} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Hora Fin</label>
                                <input type="time" className="input-field" value={agenda.hora_fin}
                                  onChange={e => setAgenda(a => ({ ...a, hora_fin: e.target.value }))} />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1.5">Tecnico Asignado</label>
                              <select className="input-field" value={agenda.tecnico}
                                onChange={e => setAgenda(a => ({ ...a, tecnico: e.target.value }))}>
                                <option value="">— Seleccionar tecnico —</option>
                                {tecnicos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Reprogramar */}
                        {reprogramar && (
                          <div className="rounded-lg border border-blue-200 bg-white p-4 space-y-4">
                            <h4 className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                              </svg>
                              Reprogramar Llamada
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha de proxima llamada <span className="text-red-500">*</span></label>
                                <input type="date" className="input-field" value={repFecha} onChange={e => setRepFecha(e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Hora de llamada <span className="text-red-500">*</span></label>
                                <input type="time" className="input-field" value={repHora} onChange={e => setRepHora(e.target.value)} />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Motivo de reprogramacion</label>
                                <textarea className="input-field min-h-[60px] resize-none"
                                  placeholder="Por que se reprograma esta llamada..."
                                  value={repMotivo} onChange={e => setRepMotivo(e.target.value)} />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Mensajes */}
                        {mensaje && (
                          <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                            mensaje.startsWith('OK')
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>{mensaje}</div>
                        )}

                        {/* Botones */}
                        <div className="flex justify-end gap-3">
                          <button onClick={cerrarForm} className="btn-secondary">Cancelar</button>
                          <button onClick={handleGuardarLlamada} disabled={guardando}
                            className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5">
                            {guardando ? 'Guardando...' : 'Guardar y Siguiente'}
                            {!guardando && (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Historial de servicios */}
                    <div className="space-y-2">
                      {c.servicios.map((s, i) => (
                        <div key={`${s.historial_id}-${i}`}
                          className={`rounded-lg border px-4 py-3 ${
                            s.agendamiento_id ? 'bg-slate-50 border-slate-150' : 'bg-slate-50/50 border-slate-100'
                          }`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                  {fmtFechaHora(s.inicio_llamada)}
                                </span>
                                {s.estado_servicio ? (
                                  <span className={`badge ${estadoBadge[s.estado_servicio] || 'badge-gray'}`}>
                                    {s.estado_servicio}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-semibold">
                                    {s.acepto_servicio ? 'Llamada con agenda' : 'Sin agendar'}
                                  </span>
                                )}
                                {s.metodo_pago && (
                                  <span className={`px-2 py-0.5 text-[10px] rounded font-semibold ${metodoBadge[s.metodo_pago] || 'bg-slate-100 text-slate-600'}`}>
                                    {s.metodo_pago}
                                  </span>
                                )}
                              </div>

                              {s.equipos && (
                                <p className="text-xs text-slate-600">
                                  <span className="font-medium">Equipos:</span> {s.equipos} &middot; {s.tipo_servicio}
                                </p>
                              )}

                              {s.fecha_agendamiento && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                  <span className="font-medium">Fecha atencion:</span> {fmtFecha(s.fecha_agendamiento)}
                                  {s.costo_cop > 0 && <> &middot; <span className="font-semibold text-slate-700">{fmt(s.costo_cop)}</span></>}
                                </p>
                              )}

                              {s.obs_marcacion && (
                                <div className="mt-2 bg-blue-50 border border-blue-200 rounded px-2.5 py-1.5">
                                  <p className="text-[11px] text-blue-700">
                                    <span className="font-semibold">Marcacion:</span> {s.obs_marcacion}
                                  </p>
                                </div>
                              )}

                              {s.obs_tecnica && (
                                <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                                  <p className="text-[11px] text-amber-700">
                                    <span className="font-semibold">Tecnico:</span> {s.obs_tecnica}
                                  </p>
                                </div>
                              )}

                              {s.observacion_gestor && (
                                <div className="mt-1.5 bg-violet-50 border border-violet-200 rounded px-2.5 py-1.5">
                                  <p className="text-[11px] text-violet-700">
                                    <span className="font-semibold">Gestor:</span> {s.observacion_gestor}
                                    {s.valor_cotizacion > 0 && (
                                      <span className="ml-1 font-bold">— Cotizacion: {fmt(s.valor_cotizacion)}</span>
                                    )}
                                  </p>
                                </div>
                              )}

                              {s.observacion_asesora && (
                                <div className="mt-1.5 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
                                  <p className="text-[11px] text-emerald-700">
                                    <span className="font-semibold">Resultado cotizacion:</span> {s.observacion_asesora}
                                    {s.estado_cotizacion && <span className="ml-1 italic">({s.estado_cotizacion})</span>}
                                  </p>
                                </div>
                              )}

                              {s.comprobante_pago_url && (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <a href={s.comprobante_pago_url} target="_blank" rel="noreferrer"
                                    className="text-[11px] text-emerald-600 font-medium hover:underline">
                                    Ver comprobante
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {waModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !waEnviando && setWaModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <h3 className="text-sm font-bold text-slate-800">Enviar WhatsApp</h3>
              </div>
              <button onClick={() => !waEnviando && setWaModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Destinatarios</p>
                <p className="text-sm font-medium text-slate-700">
                  {waClientes.length === 1 ? `${waClientes[0].nombre} (${waClientes[0].telefono})` : `${waClientes.length} clientes seleccionados`}
                </p>
                {waClientes.length > 1 && (
                  <p className="text-xs text-green-600 mt-1">Las variables se llenan automaticamente con los datos de cada cliente</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Plantilla aprobada</label>
                {waCargandoTpl ? (
                  <p className="text-xs text-slate-400">Cargando plantillas...</p>
                ) : waTemplates.length === 0 ? (
                  <p className="text-xs text-red-500">No hay plantillas aprobadas. Crea una en Meta Business Suite.</p>
                ) : (
                  <select className="input-field" value={waTemplate} onChange={e => {
                    setWaTemplate(e.target.value);
                    const tpl = waTemplates.find(t => t.name === e.target.value);
                    const bodyComp = tpl?.components?.find(c => c.type === 'BODY');
                    const matches = bodyComp?.text?.match(/\{\{(\w+)\}\}/g) || [];
                    const paramNames = matches.map(m => m.replace(/[{}]/g, ''));
                    setWaParams(waClientes.length === 1 ? autoFillParams(paramNames, waClientes[0]) : paramNames.map(name => ({ name, value: '' })));
                  }}>
                    <option value="">Seleccionar plantilla</option>
                    {waTemplates.map(t => (
                      <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
                    ))}
                  </select>
                )}
              </div>
              {waTemplate && (() => {
                const selTpl = waTemplates.find(t => t.name === waTemplate);
                const headerType = selTpl?.components?.find(c => c.type === 'HEADER');
                if (headerType?.format === 'IMAGE') return (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Imagen del header (URL publica)</label>
                    <input type="url" className="input-field" placeholder="https://ejemplo.com/imagen.jpg"
                      value={waHeaderUrl} onChange={e => setWaHeaderUrl(e.target.value)} />
                    {waHeaderUrl && <img src={waHeaderUrl} alt="preview" className="mt-2 rounded-lg max-h-32 object-contain" onError={e => e.target.style.display='none'} />}
                  </div>
                );
                return null;
              })()}
              {waTemplate && (() => {
                const tpl = waTemplates.find(t => t.name === waTemplate);
                const bodyComp = tpl?.components?.find(c => c.type === 'BODY');
                return bodyComp?.text ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Vista previa del mensaje</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{bodyComp.text}</p>
                    </div>
                    {waParams.length > 0 && waClientes.length === 1 && waParams.map((p, i) => (
                      <div key={i}>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{`{{${p.name}}}`}</label>
                        <input type="text" className="input-field" placeholder={`Valor para ${p.name}`}
                          value={p.value} onChange={e => {
                            const next = [...waParams];
                            next[i] = { ...next[i], value: e.target.value };
                            setWaParams(next);
                          }} />
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
              {waResultado && (
                <div className={`p-3 rounded-lg text-sm ${waResultado.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {waResultado.msg}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button onClick={() => setWaModal(false)} disabled={waEnviando}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">Cancelar</button>
              <button onClick={enviarWhatsApp} disabled={waEnviando || !waTemplate}
                className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                {waEnviando ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Enviando...</>
                ) : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
