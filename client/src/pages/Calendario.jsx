import { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const TECNICOS = ['HERNAN', 'FREDY', 'OMAR', 'SANCHEZ'];

const COLORES_TECNICO = {
  'HERNAN': { bg: '#3b82f6', border: '#2563eb' },
  'FREDY': { bg: '#10b981', border: '#059669' },
  'OMAR': { bg: '#f59e0b', border: '#d97706' },
  'SANCHEZ': { bg: '#8b5cf6', border: '#7c3aed' },
};

const COLORES_ESTADO = {
  'Cumplido': { bg: '#d1fae5', border: '#059669', text: '#065f46' },
  'Cancelado por el cliente': { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' },
  'Pendiente por repuesto': { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
};

const COLOR_DEFAULT = { bg: '#94a3b8', border: '#64748b' };

function getColor(tecnico, estado) {
  if (estado && estado !== 'Agendado' && COLORES_ESTADO[estado]) {
    return COLORES_ESTADO[estado];
  }
  if (!tecnico) return COLOR_DEFAULT;
  const key = tecnico.toUpperCase().trim().split(' ')[0];
  return COLORES_TECNICO[key] || COLOR_DEFAULT;
}

export default function Calendario() {
  const { isCoordinador, isGestor } = useAuth();
  const [eventos, setEventos] = useState([]);
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [cargando, setCargando] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [enviandoWA, setEnviandoWA] = useState(false);
  const [resultadoWA, setResultadoWA] = useState(null);
  const [fechaWA, setFechaWA] = useState(new Date().toLocaleDateString('en-CA'));
  const calRef = useRef(null);
  const puedeEnviarRutas = isCoordinador || isGestor;

  const cargar = async (fetchInfo) => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (fetchInfo) {
        params.append('fecha_desde', fetchInfo.startStr.slice(0, 10));
        params.append('fecha_hasta', fetchInfo.endStr.slice(0, 10));
      }
      const { data } = await api.get(`/llamadas/calendario?${params}`);
      const evts = (data.eventos || []).map(e => {
        const color = getColor(e.tecnico, e.estado_servicio);
        const start = e.hora_inicio
          ? `${e.fecha_agendamiento}T${e.hora_inicio.padStart(5, '0')}:00`
          : e.fecha_agendamiento;
        const end = e.hora_fin
          ? `${e.fecha_agendamiento}T${e.hora_fin.padStart(5, '0')}:00`
          : e.hora_inicio
            ? `${e.fecha_agendamiento}T${sumarHoras(e.hora_inicio, 2)}:00`
            : undefined;

        return {
          id: String(e.id),
          title: `${e.tipo_servicio} — ${e.cliente_nombre}`,
          start,
          end,
          allDay: !e.hora_inicio,
          backgroundColor: color.bg,
          borderColor: color.border,
          textColor: color.text || '#fff',
          extendedProps: { ...e },
        };
      });
      setEventos(evts);
    } catch (err) {
      console.error('Error cargando calendario:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const enviarRutasWhatsApp = async () => {
    const fecha = fechaWA;
    if (!fecha) return;
    if (!confirm(`¿Enviar rutas de WhatsApp para el ${fecha}?`)) return;

    setEnviandoWA(true);
    setResultadoWA(null);
    try {
      const { data } = await api.post('/llamadas/enviar-rutas-whatsapp', { fecha });
      setResultadoWA(data);
      setTimeout(() => setResultadoWA(null), 8000);
    } catch (err) {
      setResultadoWA({ ok: false, error: err.response?.data?.error || 'Error al enviar' });
      setTimeout(() => setResultadoWA(null), 5000);
    } finally {
      setEnviandoWA(false);
    }
  };

  const eventosFiltrados = filtroTecnico
    ? eventos.filter(e => {
        const t = e.extendedProps.tecnico?.toUpperCase().trim().split(' ')[0];
        return t === filtroTecnico;
      })
    : eventos;

  const handleEventDrop = async (info) => {
    const { event } = info;
    const agId = parseInt(event.id);
    const newStart = event.start;
    const newEnd = event.end;

    const fecha = newStart.toLocaleDateString('en-CA');
    const horaInicio = event.allDay ? null : `${String(newStart.getHours()).padStart(2,'0')}:${String(newStart.getMinutes()).padStart(2,'0')}`;
    const horaFin = newEnd && !event.allDay ? `${String(newEnd.getHours()).padStart(2,'0')}:${String(newEnd.getMinutes()).padStart(2,'0')}` : null;

    try {
      await api.put('/llamadas/mover-servicio', {
        agendamiento_id: agId,
        fecha_agendamiento: fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
      });
    } catch (err) {
      console.error('Error al mover servicio:', err);
      info.revert();
    }
  };

  const handleEventResize = async (info) => {
    await handleEventDrop(info);
  };

  const handleEventClick = (info) => {
    setDetalle(info.event.extendedProps);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-slate-800">Calendario de Servicios</h1>
        <div className="flex items-center gap-3">
          {cargando && <span className="text-xs text-slate-400">Cargando...</span>}
          {puedeEnviarRutas && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input-field w-40"
                value={fechaWA}
                onChange={e => setFechaWA(e.target.value)}
              />
              <button
                onClick={enviarRutasWhatsApp}
                disabled={enviandoWA}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {enviandoWA ? 'Enviando...' : 'Enviar Rutas'}
              </button>
            </div>
          )}
          <select className="input-field w-48" value={filtroTecnico} onChange={e => setFiltroTecnico(e.target.value)}>
            <option value="">Todos los tecnicos</option>
            {TECNICOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3">
        {TECNICOS.map(t => (
          <button key={t} onClick={() => setFiltroTecnico(f => f === t ? '' : t)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
              filtroTecnico === t ? 'ring-2 ring-offset-1 ring-slate-400' : 'opacity-80 hover:opacity-100'
            }`}
            style={{ backgroundColor: COLORES_TECNICO[t].bg, color: '#fff' }}>
            <span className="w-2 h-2 rounded-full bg-white/40" />
            {t}
          </button>
        ))}
        <button onClick={() => setFiltroTecnico('')}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
            !filtroTecnico ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
          }`}>
          Todos
        </button>
      </div>

      {/* Resultado WhatsApp */}
      {resultadoWA && (
        <div className={`p-3 rounded-lg text-sm font-medium ${
          resultadoWA.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {resultadoWA.ok ? (
            <div>
              <span>{resultadoWA.enviados > 0
                ? `Rutas enviadas a ${resultadoWA.enviados} tecnico(s)`
                : resultadoWA.mensaje || 'No hay servicios para enviar'}</span>
              {resultadoWA.resultados?.map((r, i) => (
                <span key={i} className="ml-3 text-xs">
                  | {r.tecnico}: {r.estado === 'enviado' ? `${r.servicios} srv` : r.estado === 'error' ? r.error : 'sin numero'}
                </span>
              ))}
            </div>
          ) : (
            <span>{resultadoWA.error}</span>
          )}
        </div>
      )}

      {/* Calendario */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm calendar-wrapper">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale="es"
          timeZone="America/Bogota"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          buttonText={{
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Dia',
          }}
          slotMinTime="06:00:00"
          slotMaxTime="20:00:00"
          slotDuration="00:30:00"
          allDayText="Todo el dia"
          height="auto"
          editable={true}
          eventResizableFromStart={true}
          droppable={false}
          events={eventosFiltrados}
          datesSet={(info) => cargar(info)}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventClick={handleEventClick}
          nowIndicator={true}
          dayMaxEvents={3}
          eventDisplay="block"
        />
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDetalle(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">{detalle.cliente_nombre}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{detalle.tipo_servicio} — {detalle.equipos}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                detalle.estado_servicio === 'Agendado' ? 'bg-blue-100 text-blue-700' :
                detalle.estado_servicio === 'Cumplido' ? 'bg-emerald-100 text-emerald-700' :
                'bg-amber-100 text-amber-700'
              }`}>{detalle.estado_servicio}</span>
            </div>

            <div className="space-y-2 text-sm">
              {detalle.direccion && (
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-slate-600">{detalle.direccion}{detalle.barrio ? `, ${detalle.barrio}` : ''}{detalle.ciudad ? ` — ${detalle.ciudad}` : ''}</span>
                </div>
              )}
              {detalle.telefono && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${detalle.telefono}`} className="text-brand-700 font-medium">{detalle.telefono}</a>
                </div>
              )}
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-slate-600">
                  {detalle.fecha_agendamiento}
                  {detalle.hora_inicio && ` | ${detalle.hora_inicio}${detalle.hora_fin ? ` — ${detalle.hora_fin}` : ''}`}
                </span>
              </div>
              {detalle.tecnico && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-slate-600 font-medium">{detalle.tecnico}</span>
                </div>
              )}
              {detalle.costo_cop > 0 && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-emerald-700 font-semibold">${Number(detalle.costo_cop).toLocaleString('es-CO')} COP</span>
                </div>
              )}
            </div>

            <button onClick={() => setDetalle(null)}
              className="w-full py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function sumarHoras(hora, horas) {
  const [h, m] = hora.split(':').map(Number);
  const nueva = h + horas;
  return `${String(Math.min(nueva, 23)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}
