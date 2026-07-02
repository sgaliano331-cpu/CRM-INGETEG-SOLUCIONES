import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import Marcacion from './pages/Marcacion';
import ClientesNuevos from './pages/ClientesNuevos';
import ActualizacionTecnica from './pages/ActualizacionTecnica';
import PendientesCobro from './pages/PendientesCobro';
import PendientesRepuesto from './pages/PendientesRepuesto';
import Fidelizacion from './pages/Fidelizacion';
import Dashboard from './pages/Dashboard';
import Asignacion from './pages/Asignacion';
import LlamadasReprogramadas from './pages/LlamadasReprogramadas';
import Descansos from './pages/Descansos';
import CotizacionVigente from './pages/CotizacionVigente';
import MisClientes from './pages/MisClientes';
import ServiciosActualizados from './pages/ServiciosActualizados';

function PrivateRoute({ children, coordinadorOnly = false, gestorOCoord = false }) {
  const { user, isCoordinador, isGestor } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (coordinadorOnly && !isCoordinador) return <Navigate to="/" replace />;
  if (gestorOCoord && !isGestor && !isCoordinador) return <Navigate to="/" replace />;
  return children;
}

function IndexRedirect() {
  const { isCoordinador, isGestor } = useAuth();
  if (isCoordinador) return <Navigate to="/dashboard" replace />;
  if (isGestor) return <Navigate to="/actualizacion-tecnica" replace />;
  return <Marcacion />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<IndexRedirect />} />
            <Route path="clientes-nuevos" element={<ClientesNuevos />} />
            <Route
              path="actualizacion-tecnica"
              element={
                <PrivateRoute gestorOCoord>
                  <ActualizacionTecnica />
                </PrivateRoute>
              }
            />
            <Route path="pendientes-cobro" element={<PendientesCobro />} />
            <Route
              path="servicios-actualizados"
              element={
                <PrivateRoute gestorOCoord>
                  <ServiciosActualizados />
                </PrivateRoute>
              }
            />
            <Route
              path="pendientes-repuesto"
              element={
                <PrivateRoute gestorOCoord>
                  <PendientesRepuesto />
                </PrivateRoute>
              }
            />
            <Route path="llamadas-reprogramadas" element={<LlamadasReprogramadas />} />
            <Route path="cotizacion-vigente" element={<CotizacionVigente />} />
            <Route path="mis-clientes" element={<MisClientes />} />
            <Route path="descansos" element={<Descansos />} />
            <Route path="fidelizacion" element={<Fidelizacion />} />
            <Route
              path="dashboard"
              element={
                <PrivateRoute coordinadorOnly>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="asignacion"
              element={
                <PrivateRoute coordinadorOnly>
                  <Asignacion />
                </PrivateRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
