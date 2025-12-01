import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiClock,
  FiCreditCard,
  FiFilter,
  FiLayers,
  FiGrid,
  FiLock,
  FiPrinter,
  FiRefreshCcw,
  FiSearch,
  FiShoppingCart,
  FiUsers,
  FiWifi,
  FiWifiOff,
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

const PRINTER_STATUS_LABELS = {
  connected: "Ulangan",
  disconnected: "Uzilgan",
  unknown: "Kutilmoqda",
};

const TABLE_STATUS_LABELS = {
  free: "Bo'sh",
  occupied: "Band",
  reserved: "Bron",
};

const STATUS_ORDER = { free: 2, reserved: 1, occupied: 0 };

const isOrderActive = (order) => {
  if (!order) return false;
  const terminalStatuses = new Set(["closed", "cancelled"]);
  return !terminalStatuses.has(order.status);
};

const resolveVirtualOrderType = (order) => {
  if (!order) return "delivery";
  if (order.type === "soboy") return "soboy";
  if (order.type === "delivery") return "delivery";
  if (order.isDelivery) return "delivery";
  return "soboy";
};

const formatVirtualOrderMeta = (order) => {
  const formatter = new Intl.NumberFormat("uz-UZ");
  const totalRaw = Number.isFinite(Number(order?.total))
    ? Number(order.total)
    : Number(order?.subtotal || 0) + Number(order?.tax || 0) - Number(order?.discount || 0);
  const total = Math.max(0, Math.round(totalRaw || 0));
  const parts = [];
  if (total > 0) parts.push(`${formatter.format(total)} so'm`);
  const phone = order?.customer?.phone || order?.deliveryPhone || order?.phone;
  if (phone) parts.push(phone);
  const address = order?.deliveryAddress || order?.deliveryDetails?.address;
  if (address) parts.push(address);
  return parts.join(" · ");
};

const mapVirtualOrderToTable = (order) => {
  if (!order?._id) return null;
  const type = resolveVirtualOrderType(order);
  const baseLabel = type === "soboy" ? "Soboy" : "Dostavka";
  const customerName = order?.customer?.name || order?.customerName || order?.tableName || "Buyurtma";
  const shortId = order?.shortId
    || order?.displayId
    || order?.orderNumber
    || order?._id?.slice(-6)?.toUpperCase()
    || "";
  const name = customerName ? `${baseLabel}: ${customerName}` : `${baseLabel} ${shortId}`.trim();
  const meta = formatVirtualOrderMeta(order);
  return {
    _id: `virtual-${order._id}`,
    name,
    code: shortId,
    status: "occupied",
    category: baseLabel,
    isVirtual: true,
    virtualType: type,
    linkedOrder: {
      ...order,
      items: Array.isArray(order?.items) ? order.items : [],
    },
    virtualMeta: {
      meta,
      customerName,
    },
    sortTimestamp: order?.createdAt ? new Date(order.createdAt).getTime() : 0,
  };
};

const getAssignedInfo = (table) => {
  const assignedRaw = table?.assignedTo?._id || table?.assignedTo;
  let id = null;
  if (assignedRaw) {
    try {
      id = typeof assignedRaw === "string" ? assignedRaw : assignedRaw.toString();
    } catch (error) {
      id = null;
    }
  }

  return {
    id,
    name: table?.assignedTo?.name || table?.assignedToName || "",
  };
};

const isTableLockedForUser = (table, currentUserId, isManager) => {
  if (!table || table.isVirtual) return false;
  if (isManager) return false;
  if (!currentUserId) return false;
  const { id } = getAssignedInfo(table);
  if (!id) return false;
  return id !== currentUserId;
};

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
  const [virtualTables, setVirtualTables] = useState([]);
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
  const [printerStatus, setPrinterStatus] = useState({
    list: [],
    summary: { total: 0, connected: 0, disconnected: 0, failed: 0 },
    lastCheckedAt: null,
  });
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  const currentUserId = useMemo(() => (user?._id ? String(user._id) : null), [user?._id]);
  const userRole = user?.role || "";
  const isManager = userRole === "admin" || userRole === "kassir";
  const allowedRoles = new Set(["admin", "kassir", "ofitsiant"]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("uz-UZ"), []);
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const loadConfiguredPrinters = useCallback(async () => {
    try {
      const res = await api.get("/settings");
      const settings = res?.data || {};
      const printersRaw = settings?.printerSettings?.printers;
      if (!Array.isArray(printersRaw) || !printersRaw.length) return [];

      return printersRaw
        .map((printer) => ({
        printerId: printer?._id ?? null,
        name: printer?.name || "Printer",
        role: printer?.role || null,
        connectionStatus: "unknown",
        success: null,
        message: "Holat hali tekshirilmagan",
        via: printer?.dispatchMode || settings?.printerSettings?.dispatchMode || "direct",
        agentChannel: printer?.agentChannel || settings?.printerSettings?.agentChannel || "default",
        ipAddress: printer?.ipAddress || null,
        port: printer?.port || null,
        checkedAt: null,
        errorCode: null,
        }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "uz", { sensitivity: "base" }));
    } catch (error) {
      console.error("[KASSA] Printer sozlamalarini yuklashda xatolik", error);
      return [];
    }
  }, []);

  const formatCurrency = useCallback(
    (value) => `${numberFormatter.format(Math.round(value || 0))} so'm`,
    [numberFormatter]
  );

  const refreshPrinters = useCallback(async () => {
    setLoadingPrinters(true);
    try {
      const response = await api.post("/settings/refresh-printers");
      const payload = response?.data || {};
      const printersRaw = Array.isArray(payload.printers) ? payload.printers : [];
      const summary = payload.summary || {};

      const normalized = printersRaw.map((printer) => ({
        ...printer,
        checkedAt: printer?.checkedAt ? new Date(printer.checkedAt) : null,
      }));

      const sorted = [...normalized].sort((a, b) => {
        const aConnected = a.connectionStatus === "connected";
        const bConnected = b.connectionStatus === "connected";
        if (aConnected && !bConnected) return -1;
        if (!aConnected && bConnected) return 1;
        return (a.name || "").localeCompare(b.name || "", "uz", { sensitivity: "base" });
      });

      const total = Number.isFinite(Number(summary.total)) ? Number(summary.total) : sorted.length;
      const connected = Number.isFinite(Number(summary.connected))
        ? Number(summary.connected)
        : sorted.filter((item) => item.connectionStatus === "connected").length;
      const disconnected = Number.isFinite(Number(summary.disconnected))
        ? Number(summary.disconnected)
        : Math.max(0, total - connected);
      const failed = Number.isFinite(Number(summary.failed))
        ? Number(summary.failed)
        : sorted.filter((item) => item.success === false).length;

      const lastCheckedCandidate = summary.lastCheckedAt
        ? new Date(summary.lastCheckedAt)
        : sorted.reduce((latest, item) => {
            if (!item.checkedAt) return latest;
            if (!latest) return item.checkedAt;
            return item.checkedAt > latest ? item.checkedAt : latest;
          }, null);

      if (!sorted.length) {
        const fallback = await loadConfiguredPrinters();
        if (fallback.length) {
          setPrinterStatus({
            list: fallback,
            summary: {
              total: fallback.length,
              connected: 0,
              disconnected: fallback.length,
              failed: 0,
            },
            lastCheckedAt: null,
          });
          return;
        }
      }

      setPrinterStatus({
        list: sorted,
        summary: {
          total,
          connected,
          disconnected,
          failed,
        },
        lastCheckedAt: lastCheckedCandidate || (sorted.length ? sorted[0].checkedAt : null),
      });
    } catch (error) {
      console.error("[KASSA] Printer holatini yangilashda xatolik", error);
      const fallback = await loadConfiguredPrinters();
      if (fallback.length) {
        setPrinterStatus({
          list: fallback,
          summary: {
            total: fallback.length,
            connected: 0,
            disconnected: fallback.length,
            failed: 0,
          },
          lastCheckedAt: null,
        });
      }
    } finally {
      setLoadingPrinters(false);
    }
  }, [loadConfiguredPrinters]);

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

  const loadVirtualOrders = useCallback(async () => {
    try {
      const res = await api.get("/orders?deliveryOnly=true");
      const normalized = normalizeOrdersResponse(res.data);
      const active = normalized.filter((order) => isOrderActive(order));
      const mapped = active
        .map((order) => mapVirtualOrderToTable(order))
        .filter(Boolean)
        .sort((a, b) => b.sortTimestamp - a.sortTimestamp);

      setVirtualTables(mapped);

      setSelectedTable((current) => {
        if (!current?.isVirtual) return current;
        const updated = mapped.find((entry) => entry._id === current._id);
        if (!updated) {
          setSelectedOrder(null);
          return null;
        }
        setSelectedOrder({
          ...updated.linkedOrder,
          items: Array.isArray(updated.linkedOrder?.items) ? updated.linkedOrder.items : [],
          tableName: updated.name,
          table: null,
          isVirtual: true,
        });
        return updated;
      });
    } catch (error) {
      console.error("[KASSA] Virtual buyurtmalarni yuklab bo'lmadi", error);
    }
  }, []);

  const loadOrder = useCallback(async (table) => {
    if (!table?._id) {
      setSelectedOrder(null);
      return;
    }

    if (table.isVirtual && table.linkedOrder) {
      setLoadingOrder(false);
      setSelectedOrder({
        ...table.linkedOrder,
        items: Array.isArray(table.linkedOrder?.items) ? table.linkedOrder.items : [],
        tableName: table.name,
        table: null,
        isVirtual: true,
      });
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
    loadVirtualOrders();
  }, [loadTables, loadVirtualOrders]);

  useEffect(() => {
    refreshPrinters();
  }, [refreshPrinters]);

  useEffect(() => {
    loadOrder(selectedTable);
  }, [selectedTable?._id, selectedTable?.status, loadOrder]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadTables();
      loadVirtualOrders();
      refreshPrinters();
      if (selectedTable?._id) {
        loadOrder(selectedTable);
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [loadTables, loadOrder, loadVirtualOrders, refreshPrinters, selectedTable]);

  useEffect(() => {
    if (!notification) return undefined;
    const timeout = setTimeout(() => setNotification(null), 3600);
    return () => clearTimeout(timeout);
  }, [notification]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadTables(), loadVirtualOrders(), refreshPrinters()]);
      if (selectedTable?._id) {
        await loadOrder(selectedTable);
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadTables, loadOrder, loadVirtualOrders, refreshPrinters, selectedTable]);

  const handlePaid = useCallback(() => {
    setNotification({
      type: "success",
      title: "To‘lov bajarildi",
      message: `${selectedTable?.name || "Tanlangan stol"} uchun chek yopildi`,
    });
    loadTables();
    loadVirtualOrders();
    if (selectedTable?._id) {
      loadOrder(selectedTable);
    }
    refreshPrinters();
  }, [loadTables, loadOrder, loadVirtualOrders, refreshPrinters, selectedTable]);

  const handleOrderUpdate = useCallback(
    (updatedOrder) => {
      if (!updatedOrder?._id) return;
      setSelectedOrder((prev) => {
        if (!prev || prev._id !== updatedOrder._id) return prev;
        return {
          ...prev,
          ...updatedOrder,
          table: prev.table || updatedOrder.table || selectedTable,
        };
      });
      setVirtualTables((prev) => {
        let changed = false;
        const next = prev.map((entry) => {
          if (!entry?.isVirtual || entry.linkedOrder?._id !== updatedOrder._id) return entry;
          changed = true;
          const merged = { ...entry.linkedOrder, ...updatedOrder };
          return mapVirtualOrderToTable(merged) || entry;
        });
        return changed ? next.filter(Boolean).sort((a, b) => b.sortTimestamp - a.sortTimestamp) : prev;
      });
    },
    [selectedTable]
  );

  const handleTableSelect = useCallback(
    (table) => {
      if (!table) return;
      if (isTableLockedForUser(table, currentUserId, isManager)) {
        const { name } = getAssignedInfo(table);
        setNotification({
          type: "warning",
          title: "Stol boshqa ofitsiantda",
          message: `${name || "Boshqa ofitsiant"} ushbu stolga biriktirilgan.`,
        });
        return;
      }

      setSelectedTable(table);
    },
    [currentUserId, isManager, setSelectedTable, setNotification]
  );

  const allTables = useMemo(() => [...tables, ...virtualTables], [tables, virtualTables]);

  const filteredTables = useMemo(() => {
    if (!allTables.length) return [];
    const search = searchTerm.trim().toLowerCase();

    return allTables
      const category = getTableCategory(table);
      counts.set(category, (counts.get(category) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, label: formatCategoryLabel(value), count }))
      .sort((a, b) => a.label.localeCompare(b.label, "uz", { sensitivity: "base" }));
  }, [allTables]);

  const filteredTables = useMemo(() => {
    if (!allTables.length) return [];
    const search = searchTerm.trim().toLowerCase();

    return allTables
      .filter((table) => {
          table.assignedToName,
          table.assignedTo?.name,
        const statusMatch = statusFilter === "all" || table.status === statusFilter;
        if (!statusMatch) return false;

        const categoryMatch =
          categoryFilter === "all" || getTableCategory(table) === categoryFilter;
        if (!categoryMatch) return false;

        if (!search) return true;
        const haystack = [
        const lockedA = isTableLockedForUser(a, currentUserId, isManager);
        const lockedB = isTableLockedForUser(b, currentUserId, isManager);
        if (lockedA && !lockedB) return 1;
        if (!lockedA && lockedB) return -1;
          table.name,
          table.code,
          table.category,
          table.virtualMeta?.meta,
          table.virtualMeta?.customerName,
        ]
          .filter(Boolean)
  }, [allTables, statusFilter, categoryFilter, searchTerm, selectedTable, currentUserId, isManager]);
          .toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => {
        if (selectedTable?._id === a._id) return -1;
        if (selectedTable?._id === b._id) return 1;
        if (a.isVirtual && !b.isVirtual) return -1;
        if (!a.isVirtual && b.isVirtual) return 1;
        if (a.isVirtual && b.isVirtual) {
          return b.sortTimestamp - a.sortTimestamp;
        }
        const orderA = STATUS_ORDER[a.status] ?? 3;
        const orderB = STATUS_ORDER[b.status] ?? 3;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || "").localeCompare(b.name || "");
      });
  }, [allTables, statusFilter, categoryFilter, searchTerm, selectedTable]);

  useEffect(() => {
    if (!selectedTable?._id) return;

    const stillVisible = filteredTables.some((table) => table._id === selectedTable._id);
    if (!stillVisible || isTableLockedForUser(selectedTable, currentUserId, isManager)) {
      setSelectedTable(null);
      setSelectedOrder(null);
    }
  }, [filteredTables, selectedTable, currentUserId, isManager]);

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
    return timeFormatter.format(lastSync);
  }, [lastSync, timeFormatter]);

  const printerSummary = printerStatus.summary;
  const printerList = printerStatus.list;
  const printerLastCheckedLabel = useMemo(() => {
    if (!printerSummary.total) return "Printerlar sozlanmagan";
    if (!printerStatus.lastCheckedAt) return "Holat kutilmoqda";
    return `Oxirgi: ${timeFormatter.format(printerStatus.lastCheckedAt)}`;
  }, [printerStatus.lastCheckedAt, printerSummary.total, timeFormatter]);

  const formatPrinterCheckedAt = useCallback(
    (date) => {
      if (!date) return "—";
      try {
        return timeFormatter.format(date);
      } catch (error) {
        return "—";
      }
    },
    [timeFormatter]
  );

  const metricCards = useMemo(
    () => [
      {
        key: "total",
        label: "Jami stollar",
        value: tablesStats.total.toString(),
        sub: virtualTables.length
          ? `${tablesStats.free} ta bo'sh · ${virtualTables.length} ta dostavka/soboy`
          : `${tablesStats.free} ta bo'sh`,
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
        key: "printers",
        label: "Printerlar",
        value: printerSummary.total
          ? `${printerSummary.connected}/${printerSummary.total}`
          : "0",
        sub: printerLastCheckedLabel,
        icon: <FiPrinter />,
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
    [
      formatCurrency,
      orderTotals,
      printerLastCheckedLabel,
      printerSummary.connected,
      printerSummary.total,
      selectedOrder,
      tablesStats,
      virtualTables.length,
    ]
  );

  if (!user || !allowedRoles.has(userRole)) {
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
  const toastIcon = notification?.type === "success" ? <FiCreditCard /> : <FiAlertCircle />;

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

          <div className="kassa-printer-status">
            <div className="kassa-printer-status-header">
              <FiPrinter />
              <span>Printerlar</span>
              <span className={`kassa-printer-summary${loadingPrinters ? " is-syncing" : ""}`}>
                {printerSummary.total ? `${printerSummary.connected}/${printerSummary.total}` : "0"}
              </span>
              <button
                type="button"
                className="kassa-printer-refresh"
                onClick={refreshPrinters}
                disabled={loadingPrinters}
                aria-label="Printerlarni qayta tekshirish"
                title="Printerlarni qayta tekshirish"
              >
                <FiRefreshCcw />
              </button>
            </div>
            <div className="kassa-printer-list">
              {printerList.length === 0 && !loadingPrinters ? (
                <div className="kassa-printer-row kassa-printer-row--empty">
                  <span>Printerlar sozlanmagan</span>
                </div>
              ) : (
                printerList.map((printer) => {
                  const isOnline = printer.connectionStatus === "connected";
                  const isOffline = printer.connectionStatus === "disconnected";
                  const StatusIcon = isOnline ? FiWifi : isOffline ? FiWifiOff : FiClock;
                  const statusClass = isOnline ? "is-connected" : isOffline ? "is-disconnected" : "is-unknown";
                  const statusLabel = PRINTER_STATUS_LABELS[printer.connectionStatus] || "Holat kutilmoqda";
                  const rowStatusClass = `status-${printer.connectionStatus || "unknown"}`;

                  return (
                    <div
                      key={printer.printerId || printer.name}
                      className={`kassa-printer-row ${rowStatusClass}`}
                    >
                      <div className="printer-row-main">
                        <span className="printer-row-icon">
                          <StatusIcon />
                        </span>
                        <div className="printer-row-text">
                          <strong>{printer.name}</strong>
                          <span className="printer-row-meta">
                            {printer.role ? `${printer.role.toUpperCase()} · ` : ""}
                            {printer.agentChannel || "default"}
                            {printer.ipAddress ? ` · ${printer.ipAddress}` : ""}
                            {printer.port ? `:${printer.port}` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="printer-row-status">
                        <span className={`printer-status-pill ${statusClass}`}>
                          {statusLabel}
                        </span>
                        <span className="printer-row-checked">
                          {formatPrinterCheckedAt(printer.checkedAt)}
                        </span>
                      </div>
                      {printer.message && (
                        <div className="printer-row-message">{printer.message}</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
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
              <p>
                {tablesStats.total} ta stol, {tablesStats.free} ta bo‘sh
                {virtualTables.length ? ` · ${virtualTables.length} ta dostavka/soboy` : ""}
              </p>
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
                  <span className="kassa-chip-count">{allTables.length}</span>
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
                  const metaLabel = table.isVirtual
                    ? [
                        categoryLabel,
                        table.code ? `#${table.code}` : null,
                        table.virtualMeta?.meta || null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : table.code
                    ? `${categoryLabel} · #${table.code}`
                    : categoryLabel;
                  const virtualLabel = table.isVirtual
                    ? table.virtualType === "soboy"
                      ? "Soboy"
                      : "Dostavka"
                    : null;
                  const assignedInfo = getAssignedInfo(table);
                  const lockedForUser = isTableLockedForUser(table, currentUserId, isManager);

                  return (
                    <button
                      key={table._id}
                      type="button"
                      className={`kassa-table-card status-${table.status || "free"}${isSelected ? " selected" : ""}${lockedForUser ? " is-locked" : ""}`}
                      onClick={() => handleTableSelect(table)}
                    >
                      <div className="table-card-top">
                        <div className="table-card-badges">
                          <span className={`table-status-chip status-${table.status || "free"}`}>{statusLabel}</span>
                          {virtualLabel && (
                            <span className={`table-virtual-pill type-${table.virtualType || "delivery"}`}>
                              {virtualLabel}
                            </span>
                          )}
                          {lockedForUser && (
                            <span className="table-locked-pill">
                              <FiLock /> Biriktirilgan
                            </span>
                          )}
                        </div>
                        {isSelected && <span className="table-selected-pill">Aktiv</span>}
                      </div>
                      <div className="table-card-body">
                        <h3>{table.name}</h3>
                        <p className="table-card-meta">{metaLabel}</p>
                        {!table.isVirtual && assignedInfo.name && (
                          <p className={`table-assigned-label${lockedForUser ? " locked" : ""}`}>
                            Ofitsiant: {assignedInfo.name}
                          </p>
                        )}
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
              <PaymentPanel order={selectedOrder} onPaid={handlePaid} onOrderUpdate={handleOrderUpdate} />
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
          {toastIcon}
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
