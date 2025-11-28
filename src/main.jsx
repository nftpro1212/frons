// src/frontend/src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles/index.css";

const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
if (userAgent.includes("electron")) {
  document.body.classList.add("electron-shell");
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);