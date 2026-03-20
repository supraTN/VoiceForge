import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css"; // <= ton fichier Tailwind/utilitaires
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
