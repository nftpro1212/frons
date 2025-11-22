import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiClock,
  FiFilter,
  FiPrinter,
  FiRefreshCcw,
  FiSearch,
  FiShoppingBag,
  FiShoppingCart,
  FiTruck,
  FiUsers,
} from "react-icons/fi";
import useSocket from "../hooks/useSocket";
import api from "../shared/api";
import { printCheck } from "../utils/checkPrinter";
import "./Orders.css";

const TYPE_LABELS = {
  delivery: "Dostavka",
  soboy: "Soboy",
  table: "Zal",
};

const STATUS_LABELS = {
  new: "Yangi",
  pending: "Kutilmoqda",
  in_progress: "Jarayonda",
  ready: "Tayyor",
  closed: "Yopilgan",
  completed: "Yakunlangan",
  cancelled: "Bekor qilingan",
};

const deriveType = (order) => {
  if (order.type) return order.type;
  if (order.isDelivery) return "delivery";
  return "table";
};

const formatTimestamp = (value) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (error) {
    return "—";
  }
};

const relativeMinutes = (value) => {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff) || diff < 0) return "—";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Hozirgina";
  if (minutes < 60) return `${minutes} daqiqa avval`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours >= 6) return `${hours} soat avval`;
  return `${hours} soat ${rest} daqiqa avval`;
};

const matchesSearch = (order, term) => {
  if (!term) return true;
  const haystack = [
    order.tableName,
    order.tableNumber,
    order.customer?.name,
    order.createdBy?.name,
    TYPE_LABELS[deriveType(order)],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
};

const OrdersPage = () => {
  const socket = useSocket();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/orders");
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError("Buyurtmalarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleUpdate = () => {
      setRefreshing(true);
      loadOrders().finally(() => setRefreshing(false));
    };
    socket.on("order:new", handleUpdate);
    socket.on("order:updated", handleUpdate);
    return () => {
      socket.off("order:new", handleUpdate);
      socket.off("order:updated", handleUpdate);
    };
  }, [loadOrders, socket]);

  const filteredOrders = useMemo(() => {
    let list = orders.slice();
    if (typeFilter !== "all") {
      list = list.filter((order) => deriveType(order) === typeFilter);
    }
    if (searchTerm.trim()) {
      list = list.filter((order) => matchesSearch(order, searchTerm.trim()));
    }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, searchTerm, typeFilter]);

  const activeOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) => !["closed", "completed", "cancelled"].includes(order.status)
      ),
    [filteredOrders]
  );

  const completedOrders = useMemo(
    () =>
      filteredOrders.filter((order) => ["closed", "completed"].includes(order.status)),
    [filteredOrders]
  );

  const metrics = useMemo(() => {
    const total = filteredOrders.length;
    const active = activeOrders.length;
    const delivery = filteredOrders.filter((order) => deriveType(order) === "delivery").length;
    const soboy = filteredOrders.filter((order) => deriveType(order) === "soboy").length;
    return [
      {
        id: "total",
        label: "Jami buyurtma",
        value: total.toString(),
        sub: "Oxirgi 200 ta yozuv",
        icon: <FiShoppingCart />,
      },
      {
        id: "active",
        label: "Faol",
        value: active.toString(),
        sub: "Hozir bajarilmoqda",
        icon: <FiClock />,
      },
      {
        id: "delivery",
        label: "Dostavka",
        value: delivery.toString(),
        sub: "Kuryerga tayyorlanmoqda",
        icon: <FiTruck />,
      },
      {
        id: "soboy",
        label: "Soboy",
        value: soboy.toString(),
        sub: "Mijoz olib ketadi",
        icon: <FiShoppingBag />,
      },
    ];
  }, [activeOrders.length, filteredOrders, filteredOrders.length]);

  const handleSearchTrigger = useCallback(() => {
    // Filtering happens via state, so just trim input
    setSearchTerm((prev) => prev.trim());
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const handlePrint = useCallback((order) => {
    const orderType = deriveType(order);
    const checkData = {
      ...order,
      tableName:
        orderType === "delivery"
          ? "Dostavka"
          : orderType === "soboy"
          ? "Soboy"
          : order.tableName || `Stol ${order.tableNumber || "?"}`,
      items: order.items || [],
      total: order.total || 0,
      subtotal: order.subtotal || 0,
      tax: order.tax || 0,
      discount: order.discount || 0,
    };
    printCheck(checkData, {});
  }, []);

  const orderCards = (list) => {
    if (!list.length) {
      return <div className="orders-empty">Bu bo'limda buyurtma yo‘q</div>;
    }

    return list.map((order) => {
      const orderType = deriveType(order);
      const orderLabel = TYPE_LABELS[orderType] || "Buyurtma";
      const waiter = order.createdBy?.name || "Aniqlanmagan";
      const timeLabel = formatTimestamp(order.createdAt);
      const relLabel = relativeMinutes(order.createdAt);
      const statusLabel = STATUS_LABELS[order.status] || order.status || "-";
      const statusKey = order.status ? order.status.replace(/[^a-z0-9_-]/gi, "").toLowerCase() : "unknown";

      return (
        <article key={order._id} className="orders-card">
          <div className="orders-card-top">
            <div>
              <h3>{order.tableName || order.tableNumber || "Stol"}</h3>
              <span className="orders-card-meta">
                <FiUsers /> {waiter}
              </span>
            </div>
            <div className="orders-card-tags">
              <span className={`orders-type type-${orderType}`}>{orderLabel}</span>
              <span className={`orders-status status-${statusKey}`}>{statusLabel}</span>
            </div>
          </div>

          <div className="orders-card-timing">
            <span>
              <FiClock /> {timeLabel}
            </span>
            <span className="orders-card-relative">{relLabel}</span>
          </div>

          <ul className="orders-items">
            {(order.items || []).map((item, index) => (
              <li key={`${order._id}-${item.menuItem || index}`}>
                <strong>{item.qty || 1}×</strong>
                <span>{item.name}</span>
                {item.notes && <em>{item.notes}</em>}
              </li>
            ))}
          </ul>

          <footer className="orders-card-footer">
            <span className="orders-card-total">
              Jami: {Math.round(order.total || order.subtotal || 0).toLocaleString("uz-UZ")} so'm
            </span>
            <button type="button" className="orders-print-btn" onClick={() => handlePrint(order)}>
              <FiPrinter /> Chekni chop etish
            </button>
          </footer>
        </article>
      );
    });
  };

  return (
    <div className="orders-screen page-shell page-shell--full-width">
      <header className="orders-top">
       
        <div className="orders-actions">
          <div className="orders-search">
            <FiSearch className="orders-search-icon" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onBlur={handleSearchTrigger}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearchTrigger();
                }
              }}
              placeholder="Stol, mijoz yoki xodim nomi..."
            />
            {searchTerm && (
              <button type="button" className="orders-search-clear" onClick={() => setSearchTerm("")}>×</button>
            )}
          </div>
          <div className="orders-filter">
            <FiFilter />
            <span>Turini tanlang</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Barchasi</option>
              <option value="table">Zal</option>
              <option value="delivery">Dostavka</option>
              <option value="soboy">Soboy</option>
            </select>
          </div>
          <button
            type="button"
            className={`orders-refresh${refreshing ? " is-busy" : ""}`}
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <FiRefreshCcw />
            Yangilash
          </button>
        </div>
      </header>

      <section className="orders-metrics">
        {metrics.map((metric) => (
          <article key={metric.id} className="orders-metric-card">
            <span className="metric-icon">{metric.icon}</span>
            <div>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
              <p>{metric.sub}</p>
            </div>
          </article>
        ))}
      </section>

      {error && <div className="orders-alert">{error}</div>}

      <section className="orders-section">
        <header className="orders-section-head">
          <h2>Faol buyurtmalar</h2>
          <span>{activeOrders.length} ta buyurtma ko‘rinmoqda</span>
        </header>
        <div className="orders-grid">{orderCards(activeOrders)}</div>
      </section>

      <section className="orders-section">
        <header className="orders-section-head">
          <h2>Yakunlangan buyurtmalar</h2>
          <span>{completedOrders.length} ta buyurtma ko‘rinmoqda</span>
        </header>
        <div className="orders-grid">{orderCards(completedOrders)}</div>
      </section>
    </div>
  );
};

export default OrdersPage;
