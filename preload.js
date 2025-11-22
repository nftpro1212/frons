// src/frontend/preload.js
// this file runs in electron preload; we keep it minimal for now
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  // placeholder for future native integrations (printer, fs)
});