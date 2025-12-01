// src/pages/MenuPage.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTable } from "../context/TableContext.jsx";
import useSocket from "../hooks/useSocket";
import api from "../shared/api";
import defaultFoodImg from "../assets/images/default-food.png";
import "./Menu.css";

const RESTAURANT_CATEGORY_PRESETS = [
  "Salatlar",
  "Issiq zakuskalar",
  "Sho'rvalar",
  "Asosiy taomlar",
  "Gril",
  "Burgerlar",
  "Pitsa",
  "Pastalar",
  "Garnirlar",
  "Bolalar menyusi",
  "Desertlar",
  "Ichimliklar",
  "Issiq ichimliklar",
  "Sovuq ichimliklar",
  "Sharbatlar",
  "Non va bagetlar",
  "Sneklar",
  "Maxsus takliflar",
];

const emptyDraft = {
  name: "",
  category: "",
  description: "",
  price: "",
  image: null,
  productionPrinterIds: [],
  pricingMode: "fixed",
  weightUnit: "kg",
  weightStep: 0.1,
  portionOptions: [],
};

export default function MenuPage() {
  const { user, token } = useAuth();
  const { selectedTable } = useTable();
  const isWaiter = user?.role === "ofitsiant";
  const isAdmin = user?.role === "admin";
  const currentUserId = useMemo(() => (user?._id ? String(user._id) : null), [user?._id]);

  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Barchasi");
  const [cart, setCart] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [editDraft, setEditDraft] = useState(emptyDraft);
  const [showEditModal, setShowEditModal] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [printerOptions, setPrinterOptions] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [tableAccessError, setTableAccessError] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [weightOrderModal, setWeightOrderModal] = useState({ open: false, item: null, amount: "", error: "" });
  const [portionOrderModal, setPortionOrderModal] = useState({ open: false, item: null });

  const socket = useSocket();

  const ORDER_STATUS_LABELS = useMemo(
    () => ({
      new: "Yangi",
      pending: "Kutilmoqda",
      in_progress: "Jarayonda",
      ready: "Tayyor",
      closed: "Yopilgan",
      cancelled: "Bekor qilingan",
    }),
    []
  );

  // Load Menu
  const loadMenu = async (search = "") => {
    setLoading(true);
    try {
      const res = await api.get("/menu", { params: search ? { q: search } : {} });
      setMenu(res.data);
    } catch (err) {
      console.error("Menyu yuklanmadi:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPrinters = async () => {
    try {
      const res = await api.get("/settings");
      const settings = res.data?.printerSettings || {};
      const printers = Array.isArray(settings.printers)
        ? settings.printers
            .filter((printer) => printer && printer._id)
            .map((printer) => ({
              ...printer,
              _id: String(printer._id),
            }))
        : [];
      setPrinterOptions(printers);
    } catch (err) {
      console.error("Printerlar ro'yxatini yuklashda xato:", err);
    }
  };

  useEffect(() => {
    if (!token) return;
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    loadMenu();
    loadPrinters();
  }, [token]);

  // Stol buyurtmalarini yuklash (ofitsiant uchun kirish cheklovi bilan)
  const fetchTableOrders = useCallback(async () => {
    if (!selectedTable?.id) {
      setActiveOrder(null);
      setTableAccessError("");
      return;
    }

    setOrderLoading(true);
    try {
      const res = await api.get("/orders", { params: { tableId: selectedTable.id } });
      const orders = Array.isArray(res.data) ? res.data : [];

      const openOrder = orders.find(
        (order) => order && !["closed", "cancelled"].includes(order.status)
      );
      setActiveOrder(openOrder || null);
      setTableAccessError("");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403 || status === 404) {
        const message = err?.response?.data?.message
          || (status === 403
            ? "Bu stol boshqa ofitsiantga biriktirilgan."
            : "Bu stol uchun buyurtma topilmadi.");
        setTableAccessError(message);
      } else {
        console.error(err);
        setTableAccessError("Buyurtmalarni yuklab bo'lmadi.");
      }
      setActiveOrder(null);
    } finally {
      setOrderLoading(false);
    }
  }, [selectedTable?.id]);

  useEffect(() => {
    if (token && selectedTable) {
      fetchTableOrders();
    }
  }, [token, selectedTable, fetchTableOrders]);

  useEffect(() => {
    if (!socket || !selectedTable) return;
    const refresh = () => fetchTableOrders();
    socket.on("order:new", refresh);
    socket.on("order:updated", refresh);
    return () => {
      socket.off("order:new", refresh);
      socket.off("order:updated", refresh);
    };
  }, [socket, selectedTable, fetchTableOrders]);

  useEffect(() => {
    if (!selectedTable) {
      setTableAccessError("");
      setActiveOrder(null);
      setCart([]);
    }
  }, [selectedTable]);

  useEffect(() => {
    if (tableAccessError) {
      setCart([]);
    }
  }, [tableAccessError]);

  const handleSearch = () => loadMenu(query.trim());

  const priceFormatter = useMemo(() => new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }), []);
  const quantityFormatter = useMemo(() => new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 3 }), []);

  const normalizedMenuCategories = useMemo(
    () =>
      menu
        .map((item) => (item.category || "").trim())
        .filter((category) => category.length > 0),
    [menu]
  );

  const categories = useMemo(() => {
    const unique = new Set([...RESTAURANT_CATEGORY_PRESETS, ...normalizedMenuCategories]);
    return ["Barchasi", ...Array.from(unique)];
  }, [normalizedMenuCategories]);

  const availableCategories = useMemo(() => {
    const unique = new Set([...RESTAURANT_CATEGORY_PRESETS, ...normalizedMenuCategories]);
    return Array.from(unique);
  }, [normalizedMenuCategories]);

  const filteredMenu = useMemo(() => {
    if (activeCategory === "Barchasi") return menu;
    return menu.filter((i) => (i.category || "Barchasi") === activeCategory);
  }, [menu, activeCategory]);

  const printerLookup = useMemo(() => {
    const map = new Map();
    printerOptions.forEach((printer) => {
      if (!printer) return;
      const id = printer._id ? String(printer._id) : null;
      if (id) map.set(id, printer);
    });
    return map;
  }, [printerOptions]);

  const generateCartUid = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const addFixedItemToCart = (item) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (entry) =>
          entry.menuItem === item._id &&
          (entry.pricingMode || "fixed") === "fixed" &&
          (entry.portionKey || "standard") === "standard"
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const current = updated[existingIndex];
        updated[existingIndex] = {
          ...current,
          qty: Number((current.qty || 0) + 1),
        };
        return updated;
      }

      return [
        ...prev,
        {
          uid: generateCartUid(),
          menuItem: item._id,
          name: item.name,
          price: Number(item.price || 0),
          qty: 1,
          portionKey: "standard",
          portionLabel: "",
          notes: "",
          pricingMode: "fixed",
          displayQty: "",
        },
      ];
    });
  };

  const addToCart = (item) => {
    if (!isWaiter || !selectedTable || tableAccessError) return;
    const mode = item?.pricingMode || "fixed";

    if (mode === "weight") {
      setWeightOrderModal({ open: true, item, amount: "", error: "" });
      return;
    }

    const hasPortions = Array.isArray(item?.portionOptions) && item.portionOptions.length > 0;
    if (mode === "portion" && hasPortions) {
      setPortionOrderModal({ open: true, item });
      return;
    }

    addFixedItemToCart(item);
  };

  const removeFromCart = (uid) => setCart((prev) => prev.filter((entry) => entry.uid !== uid));

  const toPortionKey = (value, fallback = "portion") => {
    const base = (value || fallback).toString().trim().toLowerCase();
    const slug = base
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/-{2,}/g, "-")
      .replace(/(^-|-$)/g, "");
    return slug || fallback;
  };

  const closeWeightModal = () => setWeightOrderModal({ open: false, item: null, amount: "", error: "" });

  const handleWeightAmountChange = (raw) => {
    const sanitized = raw.replace(/[^\d.,]/g, "");
    setWeightOrderModal((prev) => ({ ...prev, amount: sanitized, error: "" }));
  };

  const closePortionModal = () => setPortionOrderModal({ open: false, item: null });

  const handleSelectPortionOption = (portion) => {
    const { item } = portionOrderModal;
    if (!item) return;

    const portionLabel = typeof portion?.label === "string" && portion.label.trim().length
      ? portion.label.trim()
      : "Porsiya";
    const portionKey = toPortionKey(portion?.key || portionLabel);
    const portionPrice = Number(portion?.price ?? item.price ?? 0);

    if (!Number.isFinite(portionPrice) || portionPrice <= 0) {
      closePortionModal();
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (entry) =>
          entry.menuItem === item._id &&
          entry.pricingMode === "portion" &&
          entry.portionKey === portionKey
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const current = updated[existingIndex];
        const newQty = Number((current.qty || 0) + 1);
        updated[existingIndex] = {
          ...current,
          qty: newQty,
          displayQty: `${quantityFormatter.format(newQty)}×`,
        };
        return updated;
      }

      return [
        ...prev,
        {
          uid: generateCartUid(),
          menuItem: item._id,
          name: item.name,
          price: portionPrice,
          qty: 1,
          portionKey,
          portionLabel,
          notes: "",
          pricingMode: "portion",
          displayQty: `${quantityFormatter.format(1)}×`,
        },
      ];
    });

    closePortionModal();
  };

  const weightSelectionPreview = useMemo(() => {
    if (!weightOrderModal.open || !weightOrderModal.item) return null;
    const unitPrice = Number(weightOrderModal.item.price || 0);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;

    const normalizedAmount = weightOrderModal.amount.replace(/\s+/g, "").replace(/,/g, ".");
    const requestedWeight = Number(normalizedAmount);
    if (!Number.isFinite(requestedWeight) || requestedWeight <= 0) return null;

    const unitLabel = weightOrderModal.item.weightUnit === "g" ? "g" : weightOrderModal.item.weightUnit || "kg";
    const normalizedWeight = Number(requestedWeight.toFixed(3));
    const totalPrice = unitPrice * normalizedWeight;
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) return null;

    return {
      weightLabel: `${quantityFormatter.format(normalizedWeight)} ${unitLabel}`,
      amountLabel: priceFormatter.format(Math.round(totalPrice)),
    };
  }, [weightOrderModal, quantityFormatter]);

  const weightModalUnitLabel = weightOrderModal.item?.weightUnit === "g"
    ? "g"
    : weightOrderModal.item?.weightUnit || "kg";
  const weightModalPlaceholder = weightModalUnitLabel === "g" ? "Masalan, 500" : "Masalan, 0.5";

  const portionOptionsForModal = Array.isArray(portionOrderModal.item?.portionOptions)
    ? portionOrderModal.item.portionOptions
    : [];
  const hasStandardPortionOption = portionOptionsForModal.some(
    (portion) => toPortionKey(portion.key || portion.label) === "standard"
  );
  const showBasePortionOption = Number(portionOrderModal.item?.price || 0) > 0 && !hasStandardPortionOption;
  const displayablePortionOptions = portionOptionsForModal.filter(
    (portion) => Number(portion.price || 0) > 0
  );
  const hasAnyPortionButtons = showBasePortionOption || displayablePortionOptions.length > 0;

  const handleConfirmCart = async () => {
    if (!selectedTable || !cart.length || tableAccessError) return;
    try {
      const itemsPayload = cart.map(({ uid, ...rest }) => rest);
      await api.post("/orders", {
        tableId: selectedTable.id,
        tableName: selectedTable.name,
        items: itemsPayload,
      });
      setCart([]);
      await fetchTableOrders();
    } catch (err) {
      const message = err?.response?.data?.message || "Buyurtmani yuborib bo'lmadi";
      window.alert(message);
      console.error(err);
    }
  };

  const confirmWeightSelection = () => {
    const { item, amount } = weightOrderModal;
    if (!item) return;

    const unitPrice = Number(item.price || 0);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setWeightOrderModal((prev) => ({ ...prev, error: "Bu taom uchun narx belgilanmagan." }));
      return;
    }

    const normalizedAmount = amount.replace(/\s+/g, "").replace(/,/g, ".");
    const requestedWeight = Number(normalizedAmount);
    if (!Number.isFinite(requestedWeight) || requestedWeight <= 0) {
      setWeightOrderModal((prev) => ({ ...prev, error: "To'g'ri og'irlik kiriting." }));
      return;
    }

    const unitLabel = item.weightUnit === "g" ? "g" : item.weightUnit || "kg";
    const minStep = Number(item.weightStep || 0);
    if (minStep > 0 && requestedWeight + 1e-9 < minStep) {
      setWeightOrderModal((prev) => ({
        ...prev,
        error: `Minimal buyurtma ${quantityFormatter.format(minStep)} ${unitLabel}.`,
      }));
      return;
    }

    if (minStep > 0) {
      const steps = requestedWeight / minStep;
      if (Math.abs(steps - Math.round(steps)) > 1e-6) {
        setWeightOrderModal((prev) => ({
          ...prev,
          error: `Og'irlik ${quantityFormatter.format(minStep)} ${unitLabel} qadamlarida bo'lishi kerak.`,
        }));
        return;
      }
    }

    const normalizedWeight = Number(requestedWeight.toFixed(3));
    const totalPrice = unitPrice * normalizedWeight;
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      setWeightOrderModal((prev) => ({ ...prev, error: "Summani hisoblashda xatolik." }));
      return;
    }

    const displayQty = `${quantityFormatter.format(normalizedWeight)} ${unitLabel}`;
    const formattedSum = priceFormatter.format(Math.round(totalPrice));

    setCart((prev) => [
      ...prev,
      {
        uid: generateCartUid(),
        menuItem: item._id,
        name: item.name,
        price: unitPrice,
        qty: normalizedWeight,
        portionKey: "weight",
        portionLabel: displayQty,
        notes: `Taxminiy summa: ${formattedSum} so‘m`,
        pricingMode: "weight",
        displayQty,
        weightUnit: unitLabel,
      },
    ]);

    closeWeightModal();
  };

  const handleAddClick = () => {
    setAddMode(true);
    setEditItem(null);
    const defaultCategory = availableCategories[0] || "";
    setEditDraft({ ...emptyDraft, category: defaultCategory, productionPrinterIds: [] });
    setShowEditModal(true);
    setIsCategoryMenuOpen(false);
  };

  const handleEditClick = (item) => {
    setAddMode(false);
    setEditItem(item);
    setEditDraft({
      name: item.name,
      category: item.category || "",
      description: item.description || "",
      price: item.price,
      image: null,
      productionPrinterIds: Array.isArray(item.productionPrinterIds)
        ? item.productionPrinterIds.map(String)
        : [],
    });
    setShowEditModal(true);
    setIsCategoryMenuOpen(false);
  };

  const handleEditSave = async () => {
    try {
      let imageUrl = editItem?.imageUrl;
      if (editDraft.image) {
        const formData = new FormData();
        formData.append("file", editDraft.image);
        formData.append("upload_preset", "menulux_upload");
        const uploadRes = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        imageUrl = uploadRes.data.url;
      }

      const payload = {
        name: editDraft.name,
        category: editDraft.category,
        description: editDraft.description,
        price: parseFloat(editDraft.price),
        imageUrl,
        productionPrinterIds: editDraft.productionPrinterIds,
      };

      if (addMode) {
        await api.post(`/menu`, payload);
      } else if (editItem?._id) {
        await api.put(`/menu/${editItem._id}`, payload);
      }

      setShowEditModal(false);
      setEditItem(null);
      setEditDraft({ ...emptyDraft, productionPrinterIds: [] });
      setAddMode(false);
      setIsCategoryMenuOpen(false);
      loadMenu();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("O‘chirishni tasdiqlang")) return;
    try {
      await api.delete(`/menu/${id}`);
      loadMenu();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePrinterSelection = (printerId) => {
    setEditDraft((prev) => {
      const current = Array.isArray(prev.productionPrinterIds) ? prev.productionPrinterIds : [];
      const id = String(printerId);
      if (current.includes(id)) {
        return { ...prev, productionPrinterIds: current.filter((pid) => pid !== id) };
      }
      return { ...prev, productionPrinterIds: [...current, id] };
    });
  };

  return (
    <div className="page-shell page-shell--full-width menu-page">
      {/* Header */}
      <header className="pos-header">
        <div className="pos-title">
          <h1>Menyu</h1>
          {selectedTable && <span className="table-badge">Stol: {selectedTable.name}</span>}
        </div>
        <div className="pos-search">
          <input
            type="text"
            placeholder="Qidiruv..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={handleSearch}>Qidirish</button>
          {isAdmin && (
            <button className="add-food-btn" onClick={handleAddClick}>
              + Taom qo'shish
            </button>
          )}
        </div>
      </header>

      {isWaiter && selectedTable && tableAccessError && (
        <div className="table-access-warning" role="alert">
          {tableAccessError}
        </div>
      )}

      {/* Category Tabs */}
      <div className="category-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`tab ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="pos-body">
        {/* Menu Grid - Kvadrat kartalar */}
        <div className="menu-grid">
          {loading ? (
            <div className="loading">Yuklanmoqda...</div>
          ) : filteredMenu.length === 0 ? (
            <div className="empty">Hech narsa topilmadi</div>
          ) : (
            filteredMenu.map((item) => (
              <div
                key={item._id}
                className="menu-card-square"
                onClick={() => isWaiter && addToCart(item)}
              >
                <div className="card-image-square">
                  <img
                    src={
                      item.imageUrl
                        ? item.imageUrl.startsWith("http")
                          ? item.imageUrl
                          : import.meta.env.VITE_API_URL + item.imageUrl
                        : defaultFoodImg
                    }
                    alt={item.name}
                  />
                </div>
                <div className="card-content-square">
                  <h3>{item.name}</h3>
                  <p className="price">{priceFormatter.format(item.price)} so‘m</p>
                  {isAdmin && Array.isArray(item.productionPrinterIds) && item.productionPrinterIds.length > 0 && (
                    <div className="printer-tags">
                      {item.productionPrinterIds.map((pid) => {
                        const printer = printerLookup.get(String(pid));
                        return (
                          <span key={pid} className="printer-tag">
                            {printer?.name || "Printer"}
                            {printer?.role ? ` • ${printer.role}` : ""}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {isAdmin && (
                    <div className="admin-actions-mini">
                      <button onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}>Tahrirlash</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}>O'chirish</button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Sidebar */}
        {isWaiter && (
          <aside className="cart-sidebar">
            <div className="waiter-order-info">
              <div className="waiter-order-head">
                <h4>Joriy buyurtma</h4>
                {activeOrder && (
                  <span className={`order-status-pill status-${activeOrder.status || "unknown"}`}>
                    {ORDER_STATUS_LABELS[activeOrder.status] || activeOrder.status || "-"}
                  </span>
                )}
              </div>
              {orderLoading ? (
                <p className="order-muted">Buyurtma ma'lumotlari yuklanmoqda...</p>
              ) : tableAccessError ? (
                <p className="order-muted">{tableAccessError}</p>
              ) : !selectedTable ? (
                <p className="order-muted">Avval stol tanlang.</p>
              ) : activeOrder ? (
                <ul className="order-items-list">
                  {(activeOrder.items || []).map((item) => (
                    <li key={item._id || item.menuItem || item.name}>
                      <span>{item.qty || 0}×</span>
                      <span>{item.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="order-muted">Bu stol uchun faol buyurtma yo'q.</p>
              )}

            </div>
            <h3>Savat</h3>
            {cart.length === 0 ? (
              <p className="empty-cart">Savat bo‘sh</p>
            ) : (
              <>
                <ul className="cart-items">
                  {cart.map((item) => (
                    <li key={item.uid}>
                      <div className="cart-item-details">
                        <div>
                          <strong>{item.displayQty || `${quantityFormatter.format(item.qty)}×`}</strong>{" "}
                          {item.name}
                        </div>
                        {item.pricingMode !== "fixed" && item.portionLabel && item.portionLabel !== item.displayQty && (
                          <div className="cart-subtext">{item.portionLabel}</div>
                        )}
                        {item.notes && <div className="cart-subtext">{item.notes}</div>}
                      </div>
                      <div className="cart-price">
                        {priceFormatter.format(Math.round(item.price * item.qty))} so‘m
                        <button onClick={() => removeFromCart(item.uid)}>×</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="cart-total">
                  <strong>Jami:</strong>{" "}
                  {priceFormatter.format(
                    Math.round(
                      cart.reduce((acc, entry) => acc + Number(entry.price || 0) * Number(entry.qty || 0), 0)
                    )
                  )} so‘m
                </div>
                {window.location.pathname === "/delivery" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className={orderType === "delivery" ? "confirm-btn active" : "confirm-btn"} onClick={() => { setOrderType("delivery"); handleConfirmCart(); }}>Dostavka</button>
                    <button className={orderType === "soboy" ? "confirm-btn active" : "confirm-btn"} onClick={() => { setOrderType("soboy"); handleConfirmCart(); }}>Soboy</button>
                  </div>
                ) : (
                  <button
                    className="confirm-btn"
                    onClick={handleConfirmCart}
                    disabled={!cart.length || !selectedTable || Boolean(tableAccessError)}
                  >
                    {activeOrder ? "Buyurtmaga qo'shish" : "Oshxonaga yuborish"}
                  </button>
                )}
              </>
            )}
          </aside>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowEditModal(false);
            setAddMode(false);
            setIsCategoryMenuOpen(false);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{addMode ? "Yangi taom qo'shish" : "Taomni tahrirlash"}</h3>
            <input
              value={editDraft.name}
              onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
              placeholder="Nomi"
            />
            <div className={`category-select-wrapper ${isCategoryMenuOpen ? "open" : ""}`}>
              <div className="category-input-box">
                <input
                  value={editDraft.category}
                  onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                  placeholder="Kategoriya"
                  autoComplete="off"
                  onFocus={() => setIsCategoryMenuOpen(true)}
                  onBlur={() => setTimeout(() => setIsCategoryMenuOpen(false), 120)}
                />
                {availableCategories.length > 0 && (
                  <button
                    type="button"
                    className="category-dropdown-toggle"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
                    aria-label="Kategoriyalar ro'yxatini ochish"
                  >
                    ▾
                  </button>
                )}
              </div>
              {availableCategories.length > 0 && (
                <div className="category-option-list" role="listbox">
                  {availableCategories.map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      className={editDraft.category === cat ? "category-chip active" : "category-chip"}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setEditDraft((prev) => ({ ...prev, category: cat }));
                        setIsCategoryMenuOpen(false);
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              type="number"
              value={editDraft.price}
              onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value })}
              placeholder="Narxi (so'm)"
            />
            <textarea
              value={editDraft.description}
              onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
              placeholder="Tavsif (ixtiyoriy)"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setEditDraft({ ...editDraft, image: e.target.files[0] })}
            />
            {printerOptions.length > 0 && (
              <div className="printer-select">
                <span className="printer-select-title">Chek printerlari</span>
                <div className="printer-select-grid">
                  {printerOptions.map((printer) => (
                    <label key={printer._id} className="printer-select-option">
                      <input
                        type="checkbox"
                        checked={editDraft.productionPrinterIds?.includes(String(printer._id)) || false}
                        onChange={() => togglePrinterSelection(printer._id)}
                      />
                      <span>
                        {printer.name}
                        {printer.role ? ` (${printer.role})` : ""}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button onClick={handleEditSave}>{addMode ? "Qo'shish" : "Saqlash"}</button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setAddMode(false);
                  setIsCategoryMenuOpen(false);
                }}
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {weightOrderModal.open && weightOrderModal.item && (
        <div className="modal-overlay" onClick={closeWeightModal}>
          <div className="modal weight-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{weightOrderModal.item.name}</h3>
            <p className="modal-description">
              Kerakli og'irlikni kiriting. Jami summa avtomatik hisoblanadi.
            </p>
            <div className="weight-modal-summary">
              <span>1 {weightModalUnitLabel} uchun narx</span>
              <strong>{priceFormatter.format(weightOrderModal.item.price)} so‘m</strong>
            </div>
            {Number(weightOrderModal.item.weightStep || 0) > 0 && (
              <div className="weight-modal-summary">
                <span>Minimal buyurtma</span>
                <strong>
                  {quantityFormatter.format(Number(weightOrderModal.item.weightStep))}{" "}
                  {weightModalUnitLabel}
                </strong>
              </div>
            )}
            <label className="modal-field">
              <span>Og'irlik ({weightModalUnitLabel}):</span>
              <input
                type="text"
                inputMode="decimal"
                value={weightOrderModal.amount}
                onChange={(e) => handleWeightAmountChange(e.target.value)}
                placeholder={weightModalPlaceholder}
                autoFocus
              />
            </label>
            {weightSelectionPreview && (
              <div className="weight-preview">
                <div>Tanlangan miqdor: <strong>{weightSelectionPreview.weightLabel}</strong></div>
                <div>Taxminiy summa: <strong>{weightSelectionPreview.amountLabel} so‘m</strong></div>
              </div>
            )}
            {weightOrderModal.error && <p className="modal-error">{weightOrderModal.error}</p>}
            <div className="modal-actions">
              <button onClick={confirmWeightSelection}>Savatga qo'shish</button>
              <button onClick={closeWeightModal}>Bekor qilish</button>
            </div>
          </div>
        </div>
      )}

      {portionOrderModal.open && portionOrderModal.item && (
        <div className="modal-overlay" onClick={closePortionModal}>
          <div className="modal portion-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{portionOrderModal.item.name}</h3>
            <p className="modal-description">Qaysi porsiyani tanlaysiz?</p>
            <div className="portion-options">
              {showBasePortionOption && (
                <button
                  type="button"
                  className="portion-option"
                  onClick={() =>
                    handleSelectPortionOption({
                      key: "standard",
                      label: "Standart porsiya",
                      price: portionOrderModal.item.price,
                    })
                  }
                >
                  <span>Standart porsiya</span>
                  <strong>{priceFormatter.format(portionOrderModal.item.price)} so‘m</strong>
                </button>
              )}
              {displayablePortionOptions.map((portion) => (
                  <button
                    type="button"
                    key={portion.key || portion.label || portion.price}
                    className="portion-option"
                    onClick={() => handleSelectPortionOption(portion)}
                  >
                    <span>{portion.label || "Porsiya"}</span>
                    <strong>{priceFormatter.format(portion.price || 0)} so‘m</strong>
                  </button>
                ))}
            </div>
            {!hasAnyPortionButtons && (
              <p className="modal-empty-note">Bu taom uchun porsiyalar belgilanmagan.</p>
            )}
            <div className="modal-actions single-action">
              <button onClick={closePortionModal}>Bekor qilish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}