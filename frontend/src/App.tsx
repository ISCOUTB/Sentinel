// ─────────────────────────────────────────────────────────────────────────────
// Sentinel HMI — Application Routing & Protection
// ─────────────────────────────────────────────────────────────────────────────

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Register from "./pages/Register";
import ConfirmEmail from "./pages/ConfirmEmail";
import { useAuth } from "./contexts/AuthContext";
import { IoTProvider } from "./contexts/IoTContext";

/**
 * Componente Wrapper para proteger rutas que requieren autenticación.
 * 
 * Si el usuario se está validando o cargando, muestra un indicador de carga.
 * Si está autenticado, renderiza los hijos. Si no, redirige al Login ("/").
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Cargando...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/" />;
};

/**
 * Componente principal de la aplicación.
 * Define la estructura de enrutamiento y envuelve la aplicación en proveedores globales
 * de notificaciones y tooltips.
 */
const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner position="bottom-right" />
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/confirm-email" element={<ConfirmEmail />} />
        
        {/* Ruta Privada Protegida — Envuelve al HMI en el proveedor del WebSocket IoT */}
        <Route
          path="/hmi"
          element={
            <ProtectedRoute>
              <IoTProvider>
                <Index />
              </IoTProvider>
            </ProtectedRoute>
          }
        />
        {/* Catch-all para Páginas No Encontradas */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
