// src/frontend/src/App.jsx
import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Login from "./pages/Login.jsx";
import SelectUserPage from "./pages/SelectUserPage.jsx";
import PinLogin from "./pages/PinLogin.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Kassa from "./pages/Kassa.jsx";

import Menu from "./pages/Menu.jsx";
import Orders from "./pages/Orders.jsx";
import Tables from "./pages/Tables.jsx";
import Payments from "./pages/Payments.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import Delivery from "./pages/Delivery.jsx";
import Inventory from "./pages/Inventory.jsx";

import Layout from "./layout/Layout.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { TableProvider } from "./context/TableContext.jsx";

function PrivateRoute({ children }) {
  const { token, authStage, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) return null;

  if (!token) return <Navigate to="/login" replace />;

  const allowedDuringPinSelection = ["/select-user", "/pin"];
  if (
    authStage !== "pin" &&
    !allowedDuringPinSelection.includes(location.pathname)
  ) {
    return <Navigate to="/select-user" replace />;
  }

  if (user?.role === "ofitsiant" && location.pathname === "/") {
    return <Navigate to="/tables" replace />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <TableProvider>
        <Routes>
        {/* Login sahifa */}
        <Route path="/login" element={<Login />} />

        {/* Xodim tanlash */}
        <Route
          path="/select-user"
          element={
            <PrivateRoute>
              <SelectUserPage />
            </PrivateRoute>
          }
        />

        {/* PIN bilan kirish */}
        <Route
          path="/pin"
          element={
            <PrivateRoute>
              <PinLogin />
            </PrivateRoute>
          }
        />

        {/* Dashboard */}
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

        <Route path="/menu" element={<PrivateRoute><Menu /></PrivateRoute>} />
        <Route path="/orders" element={<PrivateRoute><Orders /></PrivateRoute>} />
        <Route path="/tables" element={<PrivateRoute><Tables /></PrivateRoute>} />
        <Route path="/payments" element={<PrivateRoute><Payments /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/delivery" element={<PrivateRoute><Delivery /></PrivateRoute>} />
        <Route path="/inventory" element={<PrivateRoute><Inventory /></PrivateRoute>} />

        {/* KASSA PANELI: faqat kassir va admin uchun */}
        <Route
          path="/kassa"
          element={
            <PrivateRoute>
              <Kassa />
            </PrivateRoute>
          }
        />
        </Routes>
      </TableProvider>
    </AuthProvider>
  );
}
