import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const EQUIPOS_DISPONIBLES = [
  'Cubierta', 'Estufas', 'Calentador', 'Horno', 'Campana Extractora',
  'Lavadora', 'Nevera', 'Aire Acondicionado', 'Redes de Gas (Reparacion)', 'Redes de Gas (Mantenimiento)'
];

export default function ClientesNuevos() {
  const { isCoordinador } = useAuth();

  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    barrio: '',
    ciudad: 'Medellin',
  });

  const [observaciones, setObservaciones] = useState('');
  const [aceptoAgendar, setAceptoAgendar] = useState(true);
  const [equiposSeleccionados, setEquiposSeleccionados] = useState([]);
  const [tipoServicio, setTipoServicio] = useState('Mantenimiento');
  const [fechaAgendamiento, setFechaAgendamiento] = useState('');
  const [costo, setCosto] = useState('18000.0');

  const [asesoras, setAsesoras] = useState([]);
  const [asesoraSeleccionada, setAsesoraSeleccionada] = useState('');
  const [esPrioridad, setEsPrioridad] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (isCoordinador) {
      api.get('/clientes/asesoras/lista').then(({ data }) => setAsesoras(data.asesoras)).catch(() => {});
    }
  }, [isCoordinador]);

  const handleToggleEquipo = (equipo) => {
    if (equiposSeleccionados.includes(equipo)) {
      setEquiposSeleccionados(equiposSeleccionados.filter(e => e !== equipo));
    } else {
      setEquiposSeleccionados([...equiposSeleccionados, equipo]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.nombre.trim()) return setMensaje('El nombre completo es obligatorio');
    if (!form.telefono.trim()) return setMensaje('El telefono es obligatorio');
    if (!observaciones.trim()) return setMensaje('Las observaciones de la llamada son obligatorias');
    if (isCoordinador && !asesoraSeleccionada) return setMensaje('Debes seleccionar una asesora para asignar el cliente');
    if (aceptoAgendar && equiposSeleccionados.length === 0) {
      return setMensaje('Debes seleccionar al menos un tipo de equipo');
    }

    setGuardando(true);
    setMensaje('');

    try {
      const resCliente = await api.post('/clientes/nuevo', {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim(),
        direccion: form.direccion.trim(),
        barrio: form.barrio.trim(),
        ciudad: form.ciudad,
        ...(isCoordinador && { asignado_a: asesoraSeleccionada, prioridad: esPrioridad }),
      });

      const clienteId = resCliente.data?.id;
      if (!clienteId) {
        throw new Error('El backend registro el cliente pero no devolvio su ID.');
      }

      const resLlamada = await api.post('/llamadas/iniciar', { cliente_id: clienteId });
      const historialId = resLlamada.data?.historial_id;

      await api.post('/llamadas/guardar', {
        historial_id: historialId,
        cliente_id: clienteId,
        observaciones: observaciones.trim(),
        acepto_servicio: aceptoAgendar,
        inicio_llamada: new Date().toISOString(),
        ...(aceptoAgendar && {
          equipos: equiposSeleccionados.join(', '),
          tipo_servicio: tipoServicio,
          fecha_agendamiento: fechaAgendamiento || new Date().toISOString().split('T')[0],
          costo_cop: parseFloat(costo) || 0,
        }),
      });

      setForm({ nombre: '', telefono: '', direccion: '', barrio: '', ciudad: 'Medellin' });
      setObservaciones('');
      setEquiposSeleccionados([]);
      setFechaAgendamiento('');
      setCosto('18000.0');
      setEsPrioridad(false);
      setMensaje('OK Registro guardado y agendado correctamente.');

    } catch (err) {
      const msgError = err.response?.data?.error || err.response?.data?.message || 'Error de comunicacion con el servidor';
      setMensaje(msgError);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Clientes Nuevos</h1>
        <p className="text-slate-500 text-sm mt-0.5">Gestion operativa de llamadas y asignacion de servicios</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Coordinator: Asesora + Priority */}
        {isCoordinador && (
          <div className="card space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Asignacion
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Asignar a Asesora *</label>
                <select className="input-field" value={asesoraSeleccionada}
                  onChange={e => setAsesoraSeleccionada(e.target.value)}>
                  <option value="">Seleccionar asesora...</option>
                  {asesoras.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className={`relative w-11 h-6 rounded-full transition-colors ${esPrioridad ? 'bg-amber-500' : 'bg-slate-200'}`}
                    onClick={() => setEsPrioridad(p => !p)}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${esPrioridad ? 'translate-x-5' : ''}`} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-700">Prioridad</span>
                    <p className="text-[10px] text-slate-400">{esPrioridad ? 'Aparecera de primero en la cola' : 'Posicion normal en cola'}</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Client info */}
        <div className="card space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Informacion del Cliente
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Nombre Completo *</label>
              <input type="text" className="input-field"
                placeholder="Nombre del cliente" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Telefono *</label>
              <input type="text" className="input-field"
                placeholder="Numero de contacto" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Ciudad</label>
              <select className="input-field"
                value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}>
                <option>Medellin</option>
                <option>Bello</option>
                <option>Itagui</option>
                <option>Envigado</option>
                <option>Sabaneta</option>
                <option>La Estrella</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Direccion</label>
              <input type="text" className="input-field"
                placeholder="Direccion residencial" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Barrio</label>
              <input type="text" className="input-field"
                placeholder="Barrio" value={form.barrio} onChange={e => setForm(f => ({ ...f, barrio: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Call management */}
        <div className="card space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Gestion de Llamada
          </h2>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Observaciones de la llamada *</label>
            <textarea
              className="input-field min-h-[90px] resize-none"
              placeholder="Detalles de la solicitud"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 cursor-pointer select-none">
            <input type="checkbox" checked={aceptoAgendar} onChange={e => setAceptoAgendar(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
            Acepto agendar servicio?
          </label>
        </div>

        {/* Scheduling */}
        {aceptoAgendar && (
          <div className="card border-emerald-200 space-y-4">
            <h2 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider border-b border-emerald-100 pb-2">
              Detalles del Agendamiento
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Tipo de Equipo(s) *</label>
              <div className="flex flex-wrap gap-1.5">
                {EQUIPOS_DISPONIBLES.map(eq => {
                  const seleccionado = equiposSeleccionados.includes(eq);
                  return (
                    <button
                      type="button"
                      key={eq}
                      onClick={() => handleToggleEquipo(eq)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                        seleccionado
                          ? 'bg-emerald-700 border-emerald-700 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {eq}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Tipo de Servicio</label>
                <select className="input-field"
                  value={tipoServicio} onChange={e => setTipoServicio(e.target.value)}>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Reparación">Reparación</option>
                  <option value="Garantía">Garantía</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha de Agendamiento</label>
                <input type="date" className="input-field"
                  value={fechaAgendamiento} onChange={e => setFechaAgendamiento(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Costo del Servicio (COP)</label>
                <input type="text" className="input-field"
                  value={costo} onChange={e => setCosto(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {mensaje && (
          <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
            mensaje.startsWith('OK')
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {mensaje}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={guardando}
            className="btn-primary flex items-center gap-2"
          >
            {guardando ? 'Procesando...' : 'Guardar y Siguiente'}
          </button>
        </div>
      </form>
    </div>
  );
}
