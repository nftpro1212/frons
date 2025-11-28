import React from "react";
import Navbar from "../components/Navbar.jsx";
import { useLocation, useNavigate } from "react-router-dom";
import "./Layout.css";
import { useAuth } from "../context/AuthContext.jsx";
import { FaPowerOff } from "react-icons/fa";
import { FiArrowLeft } from "react-icons/fi";

const ROLE_LABELS = {
  admin: "Administrator",
  kassir: "Kassir",
  ofitsiant: "Ofitsiant",
  oshpaz: "Oshpaz",
};

export default function Layout({ children }) {
  const location = useLocation();
  const hideNavbar = location.pathname === "/select-user" || location.pathname === "/select-user/";
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleLabel = ROLE_LABELS[user?.role] || (user?.role ? user.role : "—");
  const contentClass = hideNavbar ? "layout-content no-navbar" : "layout-content";
  const mainBoxClass = hideNavbar ? "layout-main-box no-navbar" : "layout-main-box";

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className={hideNavbar ? "layout-shell no-navbar" : "layout-shell"}>
      {!hideNavbar && (
        <div className="layout-nav-spacer">
          <Navbar />
        </div>
      )}
      <main className={contentClass}>
        <div className={mainBoxClass}>
          {!hideNavbar && (
            <div className="layout-main-header">
              <div className="layout-main-actions">
                <button
                  type="button"
                  className="layout-back-btn"
                  title="Orqaga qaytish"
                  onClick={handleBack}
                >
                  <FiArrowLeft />
                </button>
              </div>
              <div className="layout-user-panel">
                <div className="layout-user-meta">
                  <span className="layout-user-label">Aktiv rol</span>
                  <strong className="layout-user-role">{roleLabel}</strong>
                  {user?.name && <span className="layout-user-name">{user.name}</span>}
                </div>
                <button
                  type="button"
                  className="layout-power-btn"
                  title="Foydalanuvchini almashtirish"
                  onClick={() => navigate("/select-user")}
                >
                  <FaPowerOff />
                </button>
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
