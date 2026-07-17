import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MetasHUD from '../components/MetasHUD';
import { useEffect, useState, useRef, useCallback } from 'react';
import api from '../api/axios';

const ICON_PHONE = 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z';
const ICON_CLIENTS = 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z';
const ICON_GEAR = 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z';
const ICON_CLOCK = 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
const ICON_MONEY = 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z';
const ICON_FLASK = 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z';
const ICON_HEART = 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z';
const ICON_REST = 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z M5 3v4M3 5h4M6 17v4M4 19h4M13 1v4M11 3h4';
const ICON_DOC = 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
const ICON_USERS = 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z';

const NAV_ITEMS_ASESORA = [
  { to: '/', label: 'Marcacion', icon: ICON_PHONE, end: true },
  { to: '/clientes-nuevos', label: 'Clientes Nuevos', icon: ICON_CLIENTS },
  { to: '/mis-clientes', label: 'Mis Clientes', icon: ICON_USERS },
  { to: '/llamadas-reprogramadas', label: 'Reprogramadas', icon: ICON_CLOCK, badgeKey: 'reprogramadas' },
  { to: '/cotizacion-vigente', label: 'Cotizacion Vigente', icon: ICON_DOC, badgeKey: 'cotizaciones' },
  { to: '/pendientes-cobro', label: 'Pend. Cobro', icon: ICON_MONEY, badgeKey: 'pendientesCobro' },
  { to: '/descansos', label: 'Descansos', icon: ICON_REST },
  { to: '/fidelizacion', label: 'Fidelizacion', icon: ICON_HEART },
];

const NAV_ITEMS_COORD = [
  { to: '/clientes-nuevos', label: 'Clientes Nuevos', icon: ICON_CLIENTS, end: true },
  { to: '/actualizacion-tecnica', label: 'Act. Tecnica', icon: ICON_GEAR },
  { to: '/llamadas-reprogramadas', label: 'Reprogramadas', icon: ICON_CLOCK, badgeKey: 'reprogramadas' },
  { to: '/cotizacion-vigente', label: 'Cotizacion Vigente', icon: ICON_DOC, badgeKey: 'cotizaciones' },
  { to: '/pendientes-cobro', label: 'Pend. Cobro', icon: ICON_MONEY, badgeKey: 'pendientesCobro' },
  { to: '/pendientes-repuesto', label: 'Pend. Repuesto', icon: ICON_FLASK },
  { to: '/descansos', label: 'Descansos', icon: ICON_REST },
  { to: '/fidelizacion', label: 'Fidelizacion', icon: ICON_HEART },
];

const ICON_CHECK = 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';

const ICON_CLIPBOARD = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2';

const NAV_ITEMS_GESTOR = [
  { to: '/gestion-servicios', label: 'Gestion Servicios', icon: ICON_CLIPBOARD, end: true },
  { to: '/actualizacion-tecnica', label: 'Serv. Pendientes', icon: ICON_GEAR, badgeKey: 'serviciosPendientes' },
  { to: '/servicios-actualizados', label: 'Serv. Actualizados', icon: ICON_CHECK },
  { to: '/pendientes-repuesto', label: 'Pend. Repuesto', icon: ICON_FLASK, badgeKey: 'pendientesRepuesto' },
];

const COORD_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { to: '/asignacion', label: 'Asignacion BD', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
];

function SideIcon({ d }) {
  return (
    <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
    </svg>
  );
}

function playRingtone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [784, 988, 784, 988, 784, 988];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.18);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch (_) {}
}

function Badge({ count, pulse }) {
  if (!count) return null;
  return (
    <span className={`ml-auto min-w-[20px] h-[20px] flex items-center justify-center rounded-full text-[10px] font-bold text-white ${pulse ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}>
      {count}
    </span>
  );
}

export default function MainLayout() {
  const { user, logout, isCoordinador, isGestor } = useAuth();
  const navItems = isCoordinador ? NAV_ITEMS_COORD : isGestor ? NAV_ITEMS_GESTOR : NAV_ITEMS_ASESORA;
  const navigate = useNavigate();
  const [badges, setBadges] = useState({});
  const prevListasRef = useRef(0);

  const fetchBadges = useCallback(() => {
    api.get('/llamadas/badges')
      .then(({ data }) => {
        setBadges(data);
        if (data.reprogramadas?.listas > 0 && data.reprogramadas.listas > prevListasRef.current) {
          playRingtone();
        }
        prevListasRef.current = data.reprogramadas?.listas || 0;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchBadges();
    const iv = setInterval(fetchBadges, 60000);
    return () => clearInterval(iv);
  }, [fetchBadges]);

  const getBadgeCount = (key) => {
    if (!key) return 0;
    if (key === 'reprogramadas') return badges.reprogramadas?.total || 0;
    return badges[key] || 0;
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#0f172a] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-4 pt-4 pb-3">
          <div className="bg-white/95 rounded-xl px-3 py-2.5 flex items-center justify-center">
            <img src="/logo-ingeteg.png" alt="INGETEG Soluciones" className="h-9 w-auto" />
          </div>
        </div>

        {/* User info */}
        <div className="mx-4 px-3 py-2.5 mb-4 bg-white/[0.04] rounded-lg border border-white/[0.06]">
          <p className="text-[10px] text-slate-500 font-medium">Sesion activa</p>
          <p className="text-[13px] font-semibold text-slate-200 truncate">{user?.nombre || 'Usuario'}</p>
          <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-500/20 rounded text-[10px] font-semibold text-emerald-400">
            {user?.rol || 'N/A'}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5 scrollbar-thin">
          <p className="px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">General</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <SideIcon d={item.icon} />
              {item.label}
              <Badge
                count={getBadgeCount(item.badgeKey)}
                pulse={item.badgeKey === 'reprogramadas' && (badges.reprogramadas?.listas || 0) > 0}
              />
            </NavLink>
          ))}

          {isCoordinador && (
            <>
              <p className="px-3 pt-5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Coordinador</p>
              {COORD_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <SideIcon d={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-slate-500 hover:text-red-400 hover:bg-red-500/10"
          >
            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar Sesion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isGestor && <MetasHUD />}
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
