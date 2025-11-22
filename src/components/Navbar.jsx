import React from "react";
import { NavLink } from "react-router-dom";
import {
  FaChartLine,
  FaClipboardList,
  FaCogs,
  FaHome,
  FaTable,
  FaUtensils,
  FaCashRegister,
  FaShippingFast,
  FaCreditCard,
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext.jsx";
import "./Navbar.css";

const roleNav = {
  admin: [
    { label: "Dashboard", to: "/", icon: FaHome },
    { label: "Buyurtmalar", to: "/orders", icon: FaClipboardList },
    { label: "Menyu", to: "/menu", icon: FaUtensils },
    { label: "Stollar", to: "/tables", icon: FaTable },
    { label: "To‘lovlar", to: "/payments", icon: FaCashRegister },
    { label: "Hisobotlar", to: "/reports", icon: FaChartLine },
    { label: "Sozlamalar", to: "/settings", icon: FaCogs },
  ],
  kassir: [
    { label: "Kassa paneli", to: "/kassa", icon: FaCashRegister },
    { label: "Buyurtmalar", to: "/orders", icon: FaClipboardList },
    { label: "To‘lovlar", to: "/payments", icon: FaCreditCard },
  ],
  ofitsiant: [
    { label: "Stollar", to: "/tables", icon: FaTable },
    { label: "Buyurtmalar", to: "/orders", icon: FaClipboardList },
    { label: "Dostavka/Soboy", to: "/delivery", icon: FaShippingFast },
  ],
  oshpaz: [
    { label: "Dashboard", to: "/", icon: FaHome },
    { label: "Buyurtmalar", to: "/orders", icon: FaClipboardList },
    { label: "Menyu", to: "/menu", icon: FaUtensils },
  ],
};

export default function Navbar() {
  const { user } = useAuth();
  const navItems = roleNav[user?.role] || roleNav.admin;
  const initials = user?.name
    ?.split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("") || "ZP";

  return (
    <aside className="nav-shell">
      <div className="nav-brand">
        <div className="nav-logo" aria-label="ZarPOS logo">
          <span className="logo-emblem">{initials}</span>
        </div>
        <div className="nav-brand-meta">
          <p className="nav-brand-name">ZarPOS</p>
          <p className="nav-brand-sub">Restaurant Suite</p>
        </div>
      </div>

      <nav className="nav-list">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-icon">
                <Icon />
              </span>
              <span className="nav-text">{item.label}</span>
              <span className="nav-glow" aria-hidden="true" />
            </NavLink>
          );
        })}
      </nav>

      <div className="nav-footer">
        <div className="nav-user">
          <div className="nav-user-avatar">{initials}</div>
          <div className="nav-user-meta">
            <span className="nav-user-name">{user?.name || "Administrator"}</span>
            <span className="nav-user-role">{user?.role || "admin"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
