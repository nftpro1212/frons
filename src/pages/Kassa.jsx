import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiClock,
  FiCreditCard,
  FiFilter,
  FiLayers,
  FiGrid,
  FiRefreshCcw,
  FiSearch,
  FiShoppingCart,
  FiUsers,
} from "react-icons/fi";
import PaymentPanel from "../components/PaymentPanel";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../shared/api";
import "./Kassa.css";

const FILTER_OPTIONS = [
  { value: "all", label: "Barchasi" },
  { value: "free", label: "Bo'sh" },
  { value: "occupied", label: "Band" },
  { value: "reserved", label: "Bron" },
];

const STATUS_LABELS = {
  new: "Yangi",
  in_progress: "Jarayonda",
  ready: "Tayyor",
  closed: "Yopilgan",
  cancelled: "Bekor qilingan",
};

const TABLE_STATUS_LABELS = {
  free: "Bo'sh",
  occupied: "Band",
  reserved: "Bron",
};

const STATUS_ORDER = { free: 2, reserved: 1, occupied: 0 };

const getTableCategory = (table) => {
  if (!table) return "Boshqa";

  const candidateFields = [
    table.category,
    table.location,
    table.zone,
    table.section,
    table.area,
    table.type,
    table.room,
    table.place,
    table?.metadata?.category,
    table?.metadata?.location,
  ];

  const found = candidateFields.find((value) => typeof value === "string" && value.trim());
  if (found) return found.trim();

  const name = table.name || "";
  const [first] = name.split(/\s+/);
  return first || "Boshqa";
};

const formatCategoryLabel = (category) => {
  if (!category) return "Boshqa";
  const text = category.toString().trim();
  if (!text) return "Boshqa";

  return text
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

function normalizeTablesResponse(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.tables)) return data.tables;
  return [];
}

function normalizeOrdersResponse(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.orders)) return data.orders;
  if (data.order) return [data.order];
  return [data].filter(Boolean);
}

const Kassa = () => {
  const { user } = useAuth();

  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [tableError, setTableError] = useState("");
  const [orderError, setOrderError] = useState("");

  const [notification, setNotification] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("uz-UZ"), []);

  const formatCurrency = useCallback(
    (value) => `${numberFormatter.format(Math.round(value || 0))} so'm`,
    [numberFormatter]
  );

  const loadTables = useCallback(async () => {
    setLoadingTables(true);
    setTableError("");
    try {
      const res = await api.get("/tables");
      const normalized = normalizeTablesResponse(res.data);
      setTables(normalized);
      setLastSync(new Date());

      let shouldClearOrder = false;
      setSelectedTable((current) => {
        if (!current?._id) return current;
        const updated = normalized.find((table) => table._id === current._id);
        if (updated) {
          return updated;
        }
        shouldClearOrder = true;
        return null;
      });

      if (shouldClearOrder) {
        setSelectedOrder(null);
      }
    } catch (err) {
      setTableError(err?.response?.data?.message || "Stollarni yuklashda xatolik");
    } finally {
      setLoadingTables(false);
    }
  }, []);

  const loadOrder = useCallback(async (table) => {
    if (!table?._id) {
      setSelectedOrder(null);
      return;
    }

    setLoadingOrder(true);
    setOrderError("");
    try {
      const res = await api.get(`/orders?tableId=${table._id}`);
      const orders = normalizeOrdersResponse(res.data);
      const openOrder = orders.find((order) => {
        const tableId = (order.table?._id || order.table || "").toString();
        return tableId === table._id && order.status !== "closed" && order.status !== "cancelled";
      });

      if (openOrder) {
        setSelectedOrder({
          ...openOrder,
          items: Array.isArray(openOrder.items) ? openOrder.items : [],
          tableName: table.name || openOrder.tableName,
          table,
        });
      } else {
        setSelectedOrder(null);
      }
    } catch (err) {
      setOrderError(err?.response?.data?.message || "Buyurtmani yuklashda xatolik");
      setSelectedOrder(null);
    } finally {
      setLoadingOrder(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    loadOrder(selectedTable);
  }, [selectedTable?._id, selectedTable?.status, loadOrder]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadTables();
      if (selectedTable?._id) {
        loadOrder(selectedTable);
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [loadTables, loadOrder, selectedTable]);

  useEffect(() => {
    if (!notification) return undefined;
    const timeout = setTimeout(() => setNotification(null), 3600);
    return () => clearTimeout(timeout);
  }, [notification]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTables();
    if (selectedTable?._id) {
      await loadOrder(selectedTable);
    }
    setRefreshing(false);
  }, [loadTables, loadOrder, selectedTable]);

  const handlePaid = useCallback(() => {
    setNotification({
      type: "success",
      title: "To‘lov bajarildi",
      message: `${selectedTable?.name || "Tanlangan stol"} uchun chek yopildi`,
    });
    loadTables();
    if (selectedTable?._id) {
      loadOrder(selectedTable);
    }
  }, [loadTables, loadOrder, selectedTable]);

  const tableCategories = useMemo(() => {
    if (!tables.length) return [];

    const counts = new Map();
    tables.forEach((table) => {
      const category = getTableCategory(table);
      counts.set(category, (counts.get(category) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, label: formatCategoryLabel(value), count }))
      .sort((a, b) => a.label.localeCompare(b.label, "uz", { sensitivity: "base" }));
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (!tables.length) return [];
    const search = searchTerm.trim().toLowerCase();

    return tables
      .filter((table) => {
        const statusMatch = statusFilter === "all" || table.status === statusFilter;
        if (!statusMatch) return false;

        const categoryMatch =
          categoryFilter === "all" || getTableCategory(table) === categoryFilter;
        if (!categoryMatch) return false;

        if (!search) return true;
        const name = (table.name || "").toLowerCase();
        const code = (table.code || "").toLowerCase();
        return name.includes(search) || code.includes(search);
      })
      .sort((a, b) => {
        if (selectedTable?._id === a._id) return -1;
        if (selectedTable?._id === b._id) return 1;
        const orderA = STATUS_ORDER[a.status] ?? 3;
        const orderB = STATUS_ORDER[b.status] ?? 3;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || "").localeCompare(b.name || "");
      });
  }, [tables, statusFilter, categoryFilter, searchTerm, selectedTable]);

  useEffect(() => {
    if (!selectedTable?._id) return;
    const stillVisible = filteredTables.some((table) => table._id === selectedTable._id);
    if (!stillVisible) {
      setSelectedTable(null);
      setSelectedOrder(null);
    }
  }, [filteredTables, selectedTable]);

  useEffect(() => {
    if (categoryFilter === "all") return;
    const exists = tableCategories.some((category) => category.value === categoryFilter);
    if (!exists) {
      setCategoryFilter("all");
    }
  }, [categoryFilter, tableCategories]);

  const tablesStats = useMemo(() => {
    const total = tables.length;
    const free = tables.filter((table) => table.status === "free").length;
    const occupied = tables.filter((table) => table.status === "occupied").length;
    const reserved = tables.filter((table) => table.status === "reserved").length;
    return { total, free, occupied, reserved };
  }, [tables]);

  const orderTotals = useMemo(() => {
    if (!selectedOrder) {
      return { subtotal: 0, discount: 0, tax: 0, total: 0, itemCount: 0 };
    }

    const items = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
    const subtotal =
      typeof selectedOrder.subtotal === "number"
        ? selectedOrder.subtotal
        : items.reduce((acc, item) => acc + (item.price || 0) * (item.qty || 1), 0);
    const discount = selectedOrder.discount || 0;
    const tax = selectedOrder.tax || 0;
    const total =
      typeof selectedOrder.total === "number"
        ? selectedOrder.total
        : subtotal + tax - discount;
    const itemCount = items.reduce((acc, item) => acc + (item.qty || 0), 0);

    return { subtotal, discount, tax, total, itemCount };
  }, [selectedOrder]);

  const orderDuration = useMemo(() => {
    if (!selectedOrder?.createdAt) return "—";
    const created = new Date(selectedOrder.createdAt);
    const diffMs = Date.now() - created.getTime();
    if (Number.isNaN(diffMs) || diffMs < 0) return "—";
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    if (hours <= 0) return `${restMinutes} daq`;
    return `${hours} soat ${restMinutes} daq`;
  }, [selectedOrder]);

  const lastSyncLabel = useMemo(() => {
    if (!lastSync) return "—";
    return new Intl.DateTimeFormat("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(lastSync);
  }, [lastSync]);

  const metricCards = useMemo(
    () => [
      {
        key: "total",
        label: "Jami stollar",
        value: tablesStats.total.toString(),
        sub: `${tablesStats.free} ta bo'sh`,
        icon: <FiGrid />,
      },
      {
        key: "occupied",
        label: "Band stollar",
        value: tablesStats.occupied.toString(),
        sub: `${tablesStats.reserved} ta bron qilingan`,
        icon: <FiUsers />,
      },
      {
        key: "items",
        label: "Mahsulotlar soni",
        value: orderTotals.itemCount.toString(),
        sub: selectedOrder ? "Joriy buyurtma" : "Tanlov kutilmoqda",
        icon: <FiShoppingCart />,
      },
      {
        key: "totalAmount",
        label: "Umumiy summa",
        value: selectedOrder ? formatCurrency(orderTotals.total) : "0 so'm",
        sub: selectedOrder ? `Chegirma: ${formatCurrency(orderTotals.discount)}` : "Buyurtma tanlanmagan",
        icon: <FiCreditCard />,
      },
    ],
    [formatCurrency, orderTotals, selectedOrder, tablesStats]
  );

  if (!user || (user.role !== "kassir" && user.role !== "admin")) {
    return (
      <div className="kassa-screen page-shell page-shell--full-width">
        <div className="kassa-locked">
          <FiAlertCircle size={42} />
          <h1>Kassa paneliga kirish taqiqlangan</h1>
          <p>Sizda kassa panelidan foydalanish huquqi yo‘q. Administrator bilan bog‘laning.</p>
        </div>
      </div>
    );
  }

  const guestCount =
    selectedOrder?.guestCount ?? selectedOrder?.covers ?? selectedOrder?.guests ?? "—";
  const orderStatusKey = selectedOrder?.status || "empty";
  const orderStatusLabel = selectedOrder ? STATUS_LABELS[selectedOrder.status] || selectedOrder.status : "Buyurtma yo‘q";

  return (
    <div className="kassa-screen page-shell page-shell--full-width">
      <header className="kassa-top">
        <div className="kassa-title-group">
          <span className="kassa-tagline">LIVE KASSA</span>

          <div className="kassa-meta-line">
            <span className={`kassa-sync-dot${loadingTables || loadingOrder ? " is-syncing" : ""}`} />
            <span>Oxirgi yangilanish: {lastSyncLabel}</span>
            {selectedTable && <span>Tanlangan stol: {selectedTable.name}</span>}
          </div>
        </div>
        <div className="kassa-actions">
          <div className="kassa-search">
            <FiSearch className="kassa-search-icon" />
            <input
              type="search"
              placeholder="Stol nomi yoki kodi..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="kassa-filters">
            <span className="kassa-filter-label">
              <FiFilter /> Holat
            </span>
            <div className="kassa-filter-chips">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`kassa-filter-chip${statusFilter === option.value ? " active" : ""}`}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={`kassa-action-btn${refreshing ? " is-busy" : ""}`}
            onClick={handleRefresh}
            disabled={loadingTables && !refreshing}
          >
            <FiRefreshCcw /> Yangilash
          </button>
        </div>
      </header>

      {(tableError || orderError) && (
        <div className="kassa-alert">
          <FiAlertCircle />
          <span>{tableError || orderError}</span>
        </div>
      )}

      <section className="kassa-metrics-grid">
        {metricCards.map((card) => (
          <article key={card.key} className="kassa-metric-card">
            <span className="metric-icon">{card.icon}</span>
            <div>
              <strong>{card.value}</strong>
              <span>{card.label}</span>
              <p>{card.sub}</p>
            </div>
          </article>
        ))}
      </section>

      <div className="kassa-layout">
        <aside className="kassa-panel kassa-left-panel">
          <div className="kassa-panel-head">
            <div>
              <h2>Stollar</h2>
              <p>{tablesStats.total} ta umumiy, {tablesStats.free} ta bo‘sh</p>
            </div>
            <span className="kassa-last-sync">Sync: {lastSyncLabel}</span>
          </div>

          {tableCategories.length > 0 && (
            <div className="kassa-category-filters">
              <span className="kassa-filter-label">
                <FiLayers /> Kategoriya
              </span>
              <div className="kassa-filter-chips">
                <button
                  type="button"
                  className={`kassa-filter-chip${categoryFilter === "all" ? " active" : ""}`}
                  onClick={() => setCategoryFilter("all")}
                >
                  Barchasi
                  <span className="kassa-chip-count">{tablesStats.total}</span>
                </button>
                {tableCategories.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    className={`kassa-filter-chip${categoryFilter === category.value ? " active" : ""}`}
                    onClick={() => setCategoryFilter(category.value)}
                  >
                    {category.label}
                    <span className="kassa-chip-count">{category.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="kassa-table-board">
            <div className="kassa-table-grid">
              {loadingTables ? (
                <div className="kassa-loader">Stollar yuklanmoqda...</div>
              ) : filteredTables.length === 0 ? (
                <div className="tables-empty-state">
                  <FiAlertCircle size={32} />
                  <p>Tanlangan mezon bo‘yicha stol topilmadi.</p>
                </div>
              ) : (
                filteredTables.map((table) => {
                  const isSelected = selectedTable?._id === table._id;
                  const statusLabel = TABLE_STATUS_LABELS[table.status] || table.status || "Holatsiz";
                  const categoryValue = getTableCategory(table);
                  const categoryLabel = formatCategoryLabel(categoryValue);
                  const metaLabel = table.code ? `${categoryLabel} · #${table.code}` : categoryLabel;
                  return (
                    <button
                      key={table._id}
                      type="button"
                      className={`kassa-table-card status-${table.status || "free"}${isSelected ? " selected" : ""}`}
                      onClick={() => setSelectedTable(table)}
                    >
                      <div className="table-card-top">
                        <span className={`table-status-chip status-${table.status || "free"}`}>{statusLabel}</span>
                        {isSelected && <span className="table-selected-pill">Aktiv</span>}
                      </div>
                      <div className="table-card-body">
                        <h3>{table.name}</h3>
                        <p className="table-card-meta">{metaLabel}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        <aside className="kassa-panel kassa-right-panel">
          <div className="kassa-payment-card">
            {selectedOrder ? (
              <PaymentPanel order={selectedOrder} onPaid={handlePaid} />
            ) : (
              <div className="kassa-payment-placeholder">
                <FiCreditCard size={32} />
                <p>To‘lovni boshlash uchun stol va buyurtmani tanlang.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {notification && (
        <div className={`kassa-toast ${notification.type}`}>
          <FiCreditCard />
          <div>
            <strong>{notification.title}</strong>
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Kassa;
