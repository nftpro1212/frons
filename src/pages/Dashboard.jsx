import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../shared/api";
import useSocket from "../hooks/useSocket";
import { useAuth } from "../context/AuthContext.jsx";
import "./Dashboard.css";
import TableGrid from "../components/TableGrid";
import PaymentPanel from "../components/PaymentPanel";
import Modal from "../components/Modal";

export default function DashboardPage() {
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const socket = useSocket();
  const { user, token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const loadOrders = async () => {
      console.log("Token:", token);
      console.log("Axios headers:", api.defaults.headers.common);
      try {
        const res = await api.get("/orders");
        setOrders(res.data);
      } catch (err) {
        console.error("Buyurtmalarni yuklashda xato:", err);
      }
    };

    loadOrders();
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    const upsertOrder = (order) => {
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o._id === order._id);
        if (idx === -1) return [...prev, order];
        return prev.map((o) => (o._id === order._id ? order : o));
      });
    };

    const handleNewOrder = (order) => upsertOrder(order);
    const handleUpdatedOrder = (order) => upsertOrder(order);

    socket.on("order:new", handleNewOrder);
    socket.on("order:updated", handleUpdatedOrder);

    return () => {
      socket.off("order:new", handleNewOrder);
      socket.off("order:updated", handleUpdatedOrder);
    };
  }, [socket]);

  useEffect(() => {
    if (!token) return;

    // Load tables for kassir
    if (user?.role === "kassir") {
      api.get("/tables").then(res => setTables(res.data.tables || [])).catch(() => setTables([]));
    }
  }, [token, user]);

  const roleConfig = useMemo(() => {
    const base = {
      focusStatuses: ["new", "in_progress", "ready"],
      filter: () => true,
      quickLinks: [
        { label: "Buyurtmalar", to: "/orders" },
        { label: "To'lovlar", to: "/payments" },
        { label: "Stollar", to: "/tables" },
      ],
    };

    const configByRole = {
      kassir: {
        title: "💳 Kassir paneli",
        description: "To'lovga tayyor buyurtmalar, kassa va yopilgan hisoblar",
        focusStatuses: ["ready", "closed"],
        filter: (status) => ["ready", "closed"].includes(status),
        quickLinks: [
          { label: "Kassa paneli", to: "/kassa", highlight: true },
          { label: "To'lovlarni qabul qilish", to: "/payments" },
          { label: "Hisobotlar", to: "/reports" },
          { label: "Stollar", to: "/tables" },
        ],
      },
      ofitsiant: {
        focusStatuses: ["new", "ready"],
        filter: (status) => ["new", "ready"].includes(status),
        quickLinks: [
          { label: "Stollar", to: "/tables" },
          { label: "Buyurtmalar", to: "/orders" },
        ],
      },
      oshpaz: {
        focusStatuses: ["new", "in_progress"],
        filter: (status) => ["new", "in_progress"].includes(status),
        quickLinks: [
          { label: "Buyurtmalar oqimi", to: "/orders" },
          { label: "Menyuni yangilash", to: "/menu" },
        ],
      },
    };

    if (!user?.role) return base;
    return { ...base, ...configByRole[user.role] };
  }, [user]);

  const normalizeStatus = (status) =>
    (status || "unknown").toLowerCase().replace(/\s+/g, "_");

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => roleConfig.filter(normalizeStatus(order.status)));
  }, [orders, roleConfig]);

  const statusCounts = useMemo(() => {
    return orders.reduce((acc, order) => {
      const status = normalizeStatus(order.status);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }, [orders]);

  const statusLabels = {
    new: "Yangi",
    pending: "Kutilmoqda",
    in_progress: "Jarayonda",
    preparing: "Tayyorlanmoqda",
    ready: "Tayyor",
    served: "Yetkazildi",
    closed: "Yopilgan",
    paid: "To'langan",
    cancelled: "Bekor qilingan",
    unknown: "Holatsiz",
  };

  const focusCards = roleConfig.focusStatuses.map((status) => ({
    status,
    label: statusLabels[status] || status,
    count: statusCounts[status] || 0,
  }));

  const ordersToRender = visibleOrders.length > 0 ? visibleOrders : orders;

  return (
    <div className="page-shell page-shell--full-width dash-wrapper">
      <header className="dash-header">
        <div className="dash-header-copy">
          <h1 className="title">{roleConfig.title}</h1>
          <p className="subtitle">{roleConfig.description}</p>
        </div>
        <div className="counter">
          Ko‘rinayotgan buyurtmalar: <span>{ordersToRender.length}</span>
        </div>
      </header>
      <section className="role-summary">
        {focusCards.map((card) => (
          <div key={card.status} className="summary-card glass">
            <p className="summary-label">{card.label}</p>
            <p className="summary-value">{card.count}</p>
          </div>
        ))}
      </section>
      {!!roleConfig.quickLinks?.length && (
        <section className="role-actions">
          {roleConfig.quickLinks.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className={`action-card glass${action.highlight ? " kassir-highlight" : ""}`}
            >
              <span>{action.label}</span>
              <span className="action-icon">→</span>
            </Link>
          ))}
        </section>
      )}
      {user?.role === "kassir" && (
        <div className="dashboard-table-wrap">
          <TableGrid
            tables={tables}
            onTableClick={(table) => {
              setSelectedTable(table);
              setShowPayment(true);
            }}
          />
        </div>
      )}
      <div className="orders-grid">
        {ordersToRender.length === 0 ? (
          <p className="no-orders">Hozircha buyurtma yo‘q</p>
        ) : (
          ordersToRender.map((order) => {
            const statusKey = normalizeStatus(order.status);
            return (
              <div key={order._id} className="order-card glass">
                <div className="order-card-header">
                  <span className="table-number">
                    Stol {order.tableName || order.tableNumber || "—"}
                  </span>
                  <span className={`status-badge status-${statusKey}`}>
                    {statusLabels[statusKey] || order.status || "Noma'lum"}
                  </span>
                </div>

                <div className="order-info">
                  <p className="items-count">
                    {(order.items?.length || 0)} ta mahsulot
                  </p>

                  <div className="items-preview">
                    {order.items?.slice(0, 3).map((_, idx) => (
                      <span key={idx} className="item-dot"></span>
                    ))}
                    {order.items && order.items.length > 3 && (
                      <span className="more-items">+{order.items.length - 3}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal open={showPayment} onClose={() => setShowPayment(false)}>
        <PaymentPanel order={{ table: selectedTable, items: [], total: 0 }} onPaid={() => setShowPayment(false)} />
      </Modal>
    </div>
  );
}
