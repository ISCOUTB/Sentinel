// ─────────────────────────────────────────────────────────────────────────────
// Sentinel HMI — Frontend Entry Point
// ─────────────────────────────────────────────────────────────────────────────

// Polyfills globales necesarios para la compatibilidad con el SDK de AWS IoT
// que requiere variables globales de entorno de Node.js (Buffer y process).
import { Buffer } from 'buffer';
import process from 'process';

window.Buffer = Buffer;
window.process = process;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";

// Inicialización de React Query Client para peticiones asíncronas
const queryClient = new QueryClient();

// Renderizado del árbol de componentes en el contenedor root de index.html
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
);