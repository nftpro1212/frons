import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiBox,
  FiAlertTriangle,
  FiTrendingUp,
  FiRefreshCw,
  FiPlus,
  FiSearch,
  FiArchive,
  FiCornerUpLeft,
  FiEdit2,
  FiArrowUpCircle,
  FiArrowDownCircle,
  FiLayers,
} from "react-icons/fi";
import api from "../shared/api";
import "./Inventory.css";

const emptyForm = {
  name: "",
  sku: "",
  category: "",
  unit: "dona",
  parLevel: "",
  cost: "",
  supplier: "",
  notes: "",
  currentStock: "0",
};

const adjustInitialState = {
  type: "incoming",
  amount: "",
  reason: "",
  reference: "",
  direction: "increase",
};

const movementTypeLabels = {
  incoming: "Kelib tushdi",
  usage: "Istemol",
  waste: "Yo'qotish",
  adjustment: "Sozlash",
};

const DEFAULT_CATEGORY_OPTIONS = [
  "Go'sht va parranda",
  "Sabzavot va meva",
  "Sut mahsulotlari",
  "Non va konditer",
  "Ichimliklar",
  "Ziravorlar",
  "Quruq mahsulotlar",
  "Yarim tayyor",
  "Qadoqlash materiallari",
  "Tozalash vositalari",
  "Sovutish mahsulotlari",
];

const numberFormatter = new Intl.NumberFormat("uz-UZ");
const currencyFormatter = new Intl.NumberFormat("uz-UZ", {
  style: "currency",
  currency: "UZS",
  maximumFractionDigits: 0,
});

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ totalItems: 0, lowStock: 0, totalStockUnits: 0, inventoryValue: 0 });
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [toast, setToast] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState(emptyForm);
  const [editingItem, setEditingItem] = useState(null);

  const [selectedItem, setSelectedItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustValues, setAdjustValues] = useState(adjustInitialState);

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set([...DEFAULT_CATEGORY_OPTIONS, ...categories])).filter(
        (value) => Boolean(value) && value.trim().length > 0
      ),
    [categories]
  );

  // Auto-hide toast messages
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/inventory/items", {
          params: {
            search: search.trim(),
            category: categoryFilter,
            status: statusFilter,
          },
          signal: controller.signal,
        });

        setItems(data.items || []);
        setSummary(data.summary || { totalItems: 0, lowStock: 0, totalStockUnits: 0, inventoryValue: 0 });
        setCategories(data.categories || []);

        if (selectedItem) {
          const stillExists = data.items.find((itm) => itm._id === selectedItem._id);
          if (!stillExists) {
            setSelectedItem(null);
            setMovements([]);
          } else {
            setSelectedItem(stillExists);
          }
        }
      } catch (err) {
        if (err.code !== "ERR_CANCELED") {
          console.error("Inventory load error", err);
          setError("Ombor ma'lumotlarini olishda xatolik yuz berdi");
        }
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchData, 260);
    return () => {
      controller.abort();
      clearTimeout(debounce);
    };
  }, [search, categoryFilter, statusFilter, refreshKey, selectedItem?._id]);

  useEffect(() => {
    if (!selectedItem?._id) return;

    let active = true;
    const loadMovements = async () => {
      setMovementsLoading(true);
      try {
        const { data } = await api.get(`/inventory/items/${selectedItem._id}/movements`, {
          params: { limit: 30 },
        });
        if (active) setMovements(data.movements || []);
      } catch (err) {
        console.error("Inventory history error", err);
      } finally {
        if (active) setMovementsLoading(false);
      }
    };

    loadMovements();
    return () => {
      active = false;
    };
  }, [selectedItem?._id, refreshKey]);

  const lowStockItems = useMemo(
    () => items.filter((item) => item.parLevel > 0 && item.currentStock <= item.parLevel),
    [items]
  );

  const handleOpenForm = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormValues({
        name: item.name || "",
        sku: item.sku || "",
        category: item.category || "",
        unit: item.unit || "dona",
        parLevel: item.parLevel != null ? String(item.parLevel) : "",
        cost: item.cost != null ? String(item.cost) : "",
        supplier: item.supplier || "",
        notes: item.notes || "",
        currentStock: String(item.currentStock ?? 0),
      });
    } else {
      setEditingItem(null);
      setFormValues(emptyForm);
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormValues(emptyForm);
  };

  const handleFormChange = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const payload = {
      name: formValues.name,
      sku: formValues.sku,
      category: formValues.category,
      unit: formValues.unit,
      parLevel: formValues.parLevel,
      cost: formValues.cost,
      supplier: formValues.supplier,
      notes: formValues.notes,
    };

    if (!editingItem) {
      payload.currentStock = formValues.currentStock;
    }

    try {
      if (editingItem) {
        await api.put(`/inventory/items/${editingItem._id}`, payload);
        setToast({ type: "success", message: "Mahsulot muvaffaqiyatli yangilandi" });
      } else {
        await api.post("/inventory/items", payload);
        setToast({ type: "success", message: "Yangi mahsulot qo'shildi" });
      }
      closeForm();
      setRefreshKey((x) => x + 1);
    } catch (err) {
      console.error("Inventory save error", err);
      const message = err?.response?.data?.message || "Saqlashda xatolik yuz berdi";
      setToast({ type: "error", message });
    }
  };

  const handleSelectItem = (item) => {
    setSelectedItem((prev) => (prev?._id === item._id ? prev : item));
  };

  const handleArchive = async (item) => {
    if (!window.confirm(`${item.name} elementini arxivlashni tasdiqlaysizmi?`)) return;
    try {
      await api.delete(`/inventory/items/${item._id}`);
      setToast({ type: "success", message: "Mahsulot arxivlandi" });
      if (selectedItem?._id === item._id) {
        setSelectedItem(null);
        setMovements([]);
      }
      setRefreshKey((x) => x + 1);
    } catch (err) {
      console.error("Inventory archive error", err);
      const message = err?.response?.data?.message || "Arxivlashda xatolik";
      setToast({ type: "error", message });
    }
  };

  const openAdjustModal = (item) => {
    setSelectedItem(item);
    setAdjustValues(adjustInitialState);
    setShowAdjustModal(true);
  };

  const closeAdjustModal = () => {
    setShowAdjustModal(false);
    setAdjustValues(adjustInitialState);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    let amount = toPositiveNumber(adjustValues.amount);
    if (amount === null) {
      setToast({ type: "error", message: "Iltimos miqdorni kiriting" });
      return;
    }

    let delta = amount;
    if (adjustValues.type === "usage" || adjustValues.type === "waste") {
      delta = -amount;
    } else if (adjustValues.type === "adjustment") {
      delta = adjustValues.direction === "decrease" ? -amount : amount;
    }

    try {
      await api.post(`/inventory/items/${selectedItem._id}/adjust`, {
        quantity: delta,
        type: adjustValues.type,
        reason: adjustValues.reason,
        reference: adjustValues.reference,
      });
      setToast({ type: "success", message: "Ombor qoldig'i yangilandi" });
      closeAdjustModal();
      setRefreshKey((x) => x + 1);
    } catch (err) {
      console.error("Inventory adjust error", err);
      const message = err?.response?.data?.message || "Qoldiqni yangilashda xatolik";
      setToast({ type: "error", message });
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <div>
          <h1>Ombor nazorati</h1>
          <p>Mahsulot qoldig'i, xarid va chiqimlarni real vaqtda kuzating.</p>
        </div>
        <div className="inventory-header-actions">
          <button className="inventory-btn ghost" onClick={() => setRefreshKey((x) => x + 1)}>
            <FiRefreshCw /> Yangilash
          </button>
          <button className="inventory-btn primary" onClick={() => handleOpenForm()}>
            <FiPlus /> Yangi mahsulot
          </button>
        </div>
      </div>

      {toast && (
        <motion.div
          className={`inventory-toast ${toast.type}`}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
        >
          {toast.message}
        </motion.div>
      )}

      <div className="inventory-stats">
        <div className="inventory-stat-card">
          <span className="icon blue">
            <FiBox />
          </span>
          <div>
            <p className="label">Umumiy mahsulot</p>
            <p className="value">{numberFormatter.format(summary.totalItems || 0)}</p>
          </div>
        </div>
        <div className="inventory-stat-card">
          <span className="icon amber">
            <FiAlertTriangle />
          </span>
          <div>
            <p className="label">Past qoldiq</p>
            <p className="value">{numberFormatter.format(summary.lowStock || 0)}</p>
          </div>
        </div>
        <div className="inventory-stat-card">
          <span className="icon purple">
            <FiLayers />
          </span>
          <div>
            <p className="label">Jami birlik</p>
            <p className="value">{numberFormatter.format(summary.totalStockUnits || 0)}</p>
          </div>
        </div>
        <div className="inventory-stat-card">
          <span className="icon green">
            <FiTrendingUp />
          </span>
          <div>
            <p className="label">Inventar qiymati</p>
            <p className="value">{currencyFormatter.format(summary.inventoryValue || 0)}</p>
          </div>
        </div>
      </div>

      <div className="inventory-filters">
        <div className="inventory-search">
          <FiSearch />
          <input
            type="search"
            placeholder="Mahsulot, SKU yoki yetkazib beruvchi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="inventory-select-group">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">Barcha kategoriyalar</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="active">Faol</option>
            <option value="all">Hammasi</option>
            <option value="archived">Arxivlangan</option>
          </select>
        </div>
      </div>

      {error && <div className="inventory-error">{error}</div>}

      <div className="inventory-content">
        <div className="inventory-list">
          <div className="inventory-table-head">
            <div>Mahsulot</div>
            <div>SKU</div>
            <div>Kategoriya</div>
            <div className="text-right">Qoldiq</div>
            <div className="text-right">Par</div>
            <div>Oxirgi restok</div>
            <div className="text-right">Narxi</div>
            <div className="text-right">Harakat</div>
          </div>

          <div className="inventory-table-body">
            {loading ? (
              <div className="inventory-placeholder">Yuklanmoqda...</div>
            ) : items.length === 0 ? (
              <div className="inventory-placeholder">
                Omborda hozircha ma'lumot yo'q. Yangi mahsulot qo'shishni boshlang.
              </div>
            ) : (
              items.map((item) => {
                const isSelected = selectedItem?._id === item._id;
                const isLow = item.parLevel > 0 && item.currentStock <= item.parLevel;
                return (
                  <motion.div
                    key={item._id}
                    className={`inventory-row${isSelected ? " selected" : ""}`}
                    onClick={() => handleSelectItem(item)}
                    whileHover={{ scale: 1.002 }}
                  >
                    <div className="inventory-item-name">
                      <span className="avatar">{item.name?.charAt(0) || "?"}</span>
                      <div>
                        <p className="item-title">{item.name}</p>
                        <p className="item-sub">{item.supplier || "Yetkazib beruvchi ko'rsatilmagan"}</p>
                      </div>
                    </div>
                    <div>{item.sku || "-"}</div>
                    <div>{item.category || "-"}</div>
                    <div className={`text-right ${isLow ? "danger" : ""}`}>
                      {numberFormatter.format(item.currentStock || 0)} {item.unit || "dona"}
                    </div>
                    <div className="text-right">{item.parLevel ? numberFormatter.format(item.parLevel) : "-"}</div>
                    <div>{formatDate(item.lastRestockDate)}</div>
                    <div className="text-right">{item.cost ? currencyFormatter.format(item.cost) : "-"}</div>
                    <div className="inventory-row-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="inventory-icon-btn" onClick={() => openAdjustModal(item)} title="Qoldiqni o'zgartirish">
                        <FiArrowUpCircle />
                      </button>
                      <button className="inventory-icon-btn" onClick={() => handleOpenForm(item)} title="Tahrirlash">
                        <FiEdit2 />
                      </button>
                      {item.isActive !== false && (
                        <button className="inventory-icon-btn" onClick={() => handleArchive(item)} title="Arxivlash">
                          <FiArchive />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        <div className="inventory-details">
          {!selectedItem ? (
            <div className="inventory-placeholder">
              Mahsulotni tanlang va qoldiq tarixini ko'ring.
            </div>
          ) : (
            <div className="inventory-details-card">
              <div className="inventory-details-header">
                <div>
                  <h2>{selectedItem.name}</h2>
                  <p>{selectedItem.supplier || "Yetkazib beruvchi ko'rsatilmagan"}</p>
                </div>
                <button className="inventory-btn ghost sm" onClick={() => setSelectedItem(null)}>
                  <FiCornerUpLeft /> Yopish
                </button>
              </div>

              <div className="inventory-details-grid">
                <div>
                  <p className="label">Joriy qoldiq</p>
                  <p className="value">
                    {numberFormatter.format(selectedItem.currentStock || 0)} {selectedItem.unit || "dona"}
                  </p>
                </div>
                <div>
                  <p className="label">Par daraja</p>
                  <p className="value">{selectedItem.parLevel ? numberFormatter.format(selectedItem.parLevel) : "-"}</p>
                </div>
                <div>
                  <p className="label">SKU</p>
                  <p className="value">{selectedItem.sku || "-"}</p>
                </div>
                <div>
                  <p className="label">Kategoriya</p>
                  <p className="value">{selectedItem.category || "-"}</p>
                </div>
                <div>
                  <p className="label">Birlik narxi</p>
                  <p className="value">{selectedItem.cost ? currencyFormatter.format(selectedItem.cost) : "-"}</p>
                </div>
                <div>
                  <p className="label">Oxirgi restok</p>
                  <p className="value">{formatDate(selectedItem.lastRestockDate)}</p>
                </div>
              </div>

              {selectedItem.notes && (
                <div className="inventory-notes">
                  <strong>Eslatma:</strong>
                  <p>{selectedItem.notes}</p>
                </div>
              )}

              <div className="inventory-history-header">
                <h3>Harakatlar tarixi</h3>
                <button className="inventory-btn ghost sm" onClick={() => openAdjustModal(selectedItem)}>
                  <FiArrowUpCircle /> Qoldiqni o'zgartirish
                </button>
              </div>

              <div className="inventory-history">
                {movementsLoading ? (
                  <div className="inventory-placeholder">Tarix yuklanmoqda...</div>
                ) : movements.length === 0 ? (
                  <div className="inventory-placeholder">Hali harakatlar mavjud emas</div>
                ) : (
                  movements.map((movement) => {
                    const isIncrease = movement.delta > 0;
                    return (
                      <div key={movement._id} className="inventory-history-row">
                        <div className={`history-icon ${isIncrease ? "up" : "down"}`}>
                          {isIncrease ? <FiArrowUpCircle /> : <FiArrowDownCircle />}
                        </div>
                        <div className="history-main">
                          <p className="history-title">
                            {isIncrease ? "+" : ""}
                            {numberFormatter.format(movement.delta)} {movement.unit || selectedItem.unit}
                          </p>
                          <p className="history-sub">
                            {movementTypeLabels[movement.type] || movement.type} ・ {movement.reason || "Sabab ko'rsatilmagan"}
                          </p>
                        </div>
                        <div className="history-meta">
                          <span>{formatDate(movement.createdAt)}</span>
                          <span>Balance: {numberFormatter.format(movement.balanceAfter || 0)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div className="inventory-low-alert">
          <FiAlertTriangle />
          <div>
            <strong>Diqqat!</strong>
            <span> {lowStockItems.length} ta mahsulot par darajasidan past.</span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            className="inventory-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="inventory-modal"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
            >
              <div className="inventory-modal-header">
                <h2>{editingItem ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</h2>
                <button className="inventory-icon-btn" onClick={closeForm}>
                  ×
                </button>
              </div>
              <form className="inventory-form" onSubmit={handleSaveItem}>
                <div className="form-grid">
                  <label>
                    <span>Nom *</span>
                    <input value={formValues.name} onChange={(e) => handleFormChange("name", e.target.value)} required />
                  </label>
                  <label>
                    <span>SKU</span>
                    <input value={formValues.sku} onChange={(e) => handleFormChange("sku", e.target.value.toUpperCase())} />
                  </label>
                  <label>
                    <span>Kategoriya</span>
                    <input
                      value={formValues.category}
                      onChange={(e) => handleFormChange("category", e.target.value)}
                      list="inventory-category-options"
                      placeholder="Masalan: Sabzavot va meva"
                    />
                  </label>
                  <label>
                    <span>Birlik</span>
                    <input value={formValues.unit} onChange={(e) => handleFormChange("unit", e.target.value)} />
                  </label>
                  <label>
                    <span>Par daraja</span>
                    <input type="number" min="0" value={formValues.parLevel} onChange={(e) => handleFormChange("parLevel", e.target.value)} />
                  </label>
                  <label>
                    <span>Birlik narxi (UZS)</span>
                    <input type="number" min="0" value={formValues.cost} onChange={(e) => handleFormChange("cost", e.target.value)} />
                  </label>
                  <label>
                    <span>Yetkazib beruvchi</span>
                    <input value={formValues.supplier} onChange={(e) => handleFormChange("supplier", e.target.value)} />
                  </label>
                  {!editingItem && (
                    <label>
                      <span>Boshlang'ich qoldiq</span>
                      <input type="number" min="0" value={formValues.currentStock} onChange={(e) => handleFormChange("currentStock", e.target.value)} />
                    </label>
                  )}
                </div>
                <label className="form-notes">
                  <span>Eslatma</span>
                  <textarea rows="3" value={formValues.notes} onChange={(e) => handleFormChange("notes", e.target.value)} />
                </label>

                <div className="inventory-modal-actions">
                  <button type="button" className="inventory-btn ghost" onClick={closeForm}>
                    Bekor qilish
                  </button>
                  <button type="submit" className="inventory-btn primary">
                    Saqlash
                  </button>
                </div>
                <datalist id="inventory-category-options">
                  {categoryOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdjustModal && selectedItem && (
          <motion.div
            className="inventory-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="inventory-modal"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
            >
              <div className="inventory-modal-header">
                <h2>{selectedItem.name} — qoldiqni o'zgartirish</h2>
                <button className="inventory-icon-btn" onClick={closeAdjustModal}>
                  ×
                </button>
              </div>
              <form className="inventory-form" onSubmit={handleAdjustSubmit}>
                <div className="form-grid">
                  <label>
                    <span>Harakat turi *</span>
                    <select value={adjustValues.type} onChange={(e) => setAdjustValues((prev) => ({ ...prev, type: e.target.value }))}>
                      <option value="incoming">Kelib tushdi</option>
                      <option value="usage">Istemol</option>
                      <option value="waste">Yo'qotish / Brak</option>
                      <option value="adjustment">Manual sozlash</option>
                    </select>
                  </label>
                  <label>
                    <span>Miqdor *</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={adjustValues.amount}
                      onChange={(e) => setAdjustValues((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder={`Birlik: ${selectedItem.unit || "dona"}`}
                      required
                    />
                  </label>
                  {adjustValues.type === "adjustment" && (
                    <label>
                      <span>Yo'nalish</span>
                      <select
                        value={adjustValues.direction}
                        onChange={(e) => setAdjustValues((prev) => ({ ...prev, direction: e.target.value }))}
                      >
                        <option value="increase">Qoldiqni oshirish</option>
                        <option value="decrease">Qoldiqni kamaytirish</option>
                      </select>
                    </label>
                  )}
                </div>
                <label className="form-notes">
                  <span>Sabab</span>
                  <textarea
                    rows="2"
                    value={adjustValues.reason}
                    onChange={(e) => setAdjustValues((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="Masalan: Yetkazib berish, inventarizatsiya, brak va h.k."
                  />
                </label>
                <label className="form-notes">
                  <span>Hujjat / referens</span>
                  <input
                    value={adjustValues.reference}
                    onChange={(e) => setAdjustValues((prev) => ({ ...prev, reference: e.target.value }))}
                    placeholder="Masalan: Faktura raqami"
                  />
                </label>
                <div className="inventory-modal-actions">
                  <button type="button" className="inventory-btn ghost" onClick={closeAdjustModal}>
                    Bekor qilish
                  </button>
                  <button type="submit" className="inventory-btn primary">
                    Saqlash
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
