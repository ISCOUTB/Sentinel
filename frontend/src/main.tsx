import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

// Crea una instancia de QueryClient
const queryClient = new QueryClient();

// Envuelve tu App dentro del proveedor
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);