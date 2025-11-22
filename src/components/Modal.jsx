import React from "react";

const Modal = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.4)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{ background: "#222", borderRadius: 16, padding: 32, minWidth: 340, minHeight: 200, position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 16, background: "none", border: "none", color: "#fff", fontSize: 24, cursor: "pointer" }}>&times;</button>
        {children}
      </div>
    </div>
  );
};

export default Modal;
