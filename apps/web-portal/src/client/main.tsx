import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@zui-webos/design-system/styles.css";
import "./portal.css";
import { App } from "./App.js";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
