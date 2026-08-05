import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const ESTADOS_COLOR = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  aprobada: 'bg-green-100 text-green-800',
  rechazada: 'bg-red-100 text-red-800',
};

export default function SolicitudesCambio() {
  const { user, isCoordinador } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [agendamientos, setAgendamientos] = useState([]);
  const [form, setForm] = useState({ agendamiento_id: '', tipo: 'reprogramar', nueva_fecha: '', nueva_hora_inicio: '', nueva_hora_fin: '', motivo: '' });
  const [submitting, setSubmitting] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get('/solicitudes');
      setSolicitudes(data.solicitudes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cargarAgendamientos = async () => {
    try {
      const { data } = await api.get('/llamadas/gestion-servicios');
      const agendados = (data.servicios || []).filter(s => s.estado_servicio === 'Agendado');
      setAgendamientos(agendados);
    } catch (err) {
      console.error(err);
    }
  };

  const abrirModal = () => {
    cargarAgendamientos();
    setForm({ agendamiento_id: '', tipo: 'reprogramar', nueva_fecha: '', nueva_hora_inicio: '', nueva_hora_fin: '', motivo: '' });
    setShowModal(true);
  };

  const enviarSolicitud = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/solicitudes', form);
      setShowModal(false);
      cargar();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  const aprobar = async (id) => {
    if (!confirm('¿Aprobar esta solicitud? Se aplicarán los cambios al servicio y al calendario.')) return;
    try {
      await api.put(`/solicitudes/${id}/aprobar`);
      cargar();
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    }
  };

  const rechazar = async (id) => {
    if (!confirm('¿Rechazar esta solicitud?')) return;
    try {
      await api.put(`/solicitudes/${id}/rechazar`);
      cargar();
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    }
  };

  const formatFecha = (f) => f ? new Date(f).toLocaleDateString('es-CO') : '-';

  const filtradas = filtroEstado === 'todos' ? solicitudes : solicitudes.filter(s => s.estado === filtroEstado);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Solicitudes de Cambio</h1>
        {!isCoordinador && (
          <button onClick={abrirModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            + Nueva Solicitud
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {['todos', 'pendiente', 'aprobada', 'rechazada'].map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${filtroEstado === e ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {e === 'todos' ? 'Todos' : e.charAt(0).toUpperCase() + e.slice(1)}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No hay solicitudes</div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(s => (
            <div key={s.id} className="bg-white rounded-lg border p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADOS_COLOR[s.estado]}`}>
                      {s.estado}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.tipo === 'cancelar' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                      {s.tipo === 'cancelar' ? 'Cancelación' : 'Reprogramación'}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-800">{s.cliente_nombre}</p>
                  <p className="text-sm text-gray-500">
                    {s.tipo_servicio} {s.equipos && `- ${s.equipos}`} | Técnico: {s.tecnico || 'Sin asignar'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Fecha actual: {formatFecha(s.fecha_agendamiento)} {s.hora_actual && `${s.hora_actual}`}
                  </p>
                  {s.tipo === 'reprogramar' && (
                    <p className="text-sm text-blue-600 font-medium">
                      Nueva fecha: {formatFecha(s.nueva_fecha)} {s.nueva_hora_inicio && `${s.nueva_hora_inicio}`}
                    </p>
                  )}
                  {s.motivo && <p className="text-sm text-gray-600 mt-1 italic">"{s.motivo}"</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    Solicitado por {s.solicitante_nombre} el {formatFecha(s.creado_en)}
                    {s.revisor_nombre && ` | Revisado por ${s.revisor_nombre}`}
                  </p>
                </div>
                {isCoordinador && s.estado === 'pendiente' && (
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => aprobar(s.id)} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-700">
                      Aprobar
                    </button>
                    <button onClick={() => rechazar(s.id)} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-red-700">
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold mb-4">Nueva Solicitud de Cambio</h2>
            <form onSubmit={enviarSolicitud} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label>
                <select value={form.agendamiento_id} onChange={e => setForm({ ...form, agendamiento_id: e.target.value })} required
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Seleccionar servicio...</option>
                  {agendamientos.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.cliente_nombre} - {a.tipo_servicio} {a.equipos} ({new Date(a.fecha_agendamiento).toLocaleDateString('es-CO')})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de cambio</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tipo" value="reprogramar" checked={form.tipo === 'reprogramar'}
                      onChange={e => setForm({ ...form, tipo: e.target.value })} className="text-blue-600" />
                    <span className="text-sm">Reprogramar</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tipo" value="cancelar" checked={form.tipo === 'cancelar'}
                      onChange={e => setForm({ ...form, tipo: e.target.value })} className="text-red-600" />
                    <span className="text-sm">Cancelar</span>
                  </label>
                </div>
              </div>
              {form.tipo === 'reprogramar' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nueva fecha</label>
                    <input type="date" value={form.nueva_fecha} onChange={e => setForm({ ...form, nueva_fecha: e.target.value })} required
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
                      <input type="time" value={form.nueva_hora_inicio} onChange={e => setForm({ ...form, nueva_hora_inicio: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
                      <input type="time" value={form.nueva_hora_fin} onChange={e => setForm({ ...form, nueva_hora_fin: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <textarea value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} rows={3} placeholder="Razón del cambio..."
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
