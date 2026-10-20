import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initAuth } from "./lib/auth";
import { applyTheme } from "./components/theme";

applyTheme();
initAuth();
// Pede ao navegador para não descartar o catálogo sob pressão de espaço.
navigator.storage?.persist?.();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
