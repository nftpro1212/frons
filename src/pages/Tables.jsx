import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTable } from "../context/TableContext.jsx";
import api from "../shared/api";
import "./Tables.css";

const statusLabels = { free: "Bo‘sh", occupied: "Band", reserved: "Rezerv" };
const CATEGORY_LABELS = {
  zal: "Zal",
  kabina: "Kabina",
  tapchan: "Tapchan",
  zal2: "Zal 2",
};
const DEFAULT_CATEGORY_KEY = "zal";
const formatCategoryLabel = (key = "") => {
  if (!key) return "";
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  return key
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default function TablesPage() {
  const { token, user } = useAuth();
  const { setSelectedTable } = useTable();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState("");
  const [newTable, setNewTable] = useState("");
  const [newCategory, setNewCategory] = useState(DEFAULT_CATEGORY_KEY);
  const [activeTableId, setActiveTableId] = useState(null);
  const [editTable, setEditTable] = useState(null);
  const [editName, setEditName] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    fetchTables();
  }, [token]);

  const fetchTables = async (options = {}) => {
    const { suppressAlertReset = false } = options;
    setLoading(true);
    try {
      const res = await api.get("/tables");
      setTables(res.data);
      if (!suppressAlertReset) {
        setAlert("");
      }
    } catch (err) {
      const message = err?.response?.data?.message || "Stollarni yuklashda xatolik";
      setAlert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleTableClick = (table) => {
    if (user?.role === "ofitsiant") {
      const assignedRaw = table.assignedTo?._id || table.assignedTo;
      const assignedId = typeof assignedRaw === "string" ? assignedRaw : assignedRaw?.toString();
      const userId = user?._id ? String(user._id) : null;
      if (assignedId && userId && assignedId !== userId) {
        setAlert(`Bu stol ${table.assignedToName || table.assignedTo?.name || "boshqa ofitsiant"}ga biriktirilgan.`);
        return;
      }
    }

    setActiveTableId(table._id);
    setSelectedTable({
      id: table._id,
      name: table.name,
      status: table.status,
      category: table.category,
    });
    navigate("/menu");
  };

  const handleCreate = async () => {
    if (!newTable.trim()) return;
    try {
      await api.post("/tables", { name: newTable.trim(), category: newCategory });
      setNewTable("");
      await fetchTables({ suppressAlertReset: true });
      setAlert("Yangi stol qo‘shildi");
    } catch (err) {
      const message = err?.response?.data?.message || "Stol yaratishda xato";
      setAlert(message);
    }
  };

  const handleEditClick = (table) => {
    setEditTable(table);
    setEditName(table.name);
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    try {
      await api.put(`/tables/${editTable._id}`, { name: editName });
      setShowEditModal(false);
      setEditTable(null);
      setEditName("");
      fetchTables();
      setAlert("Stol o'zgartirildi");
    } catch (err) {
      setAlert("O'zgartirishda xatolik");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Rostdan ham o'chirmoqchimisiz?")) return;
    try {
      await api.delete(`/tables/${id}`);
      fetchTables();
      setAlert("Stol o'chirildi");
    } catch (err) {
      setAlert("O'chirishda xatolik");
    }
  };

  const handleStatusChange = async (table, status) => {
    try {
      await api.put(`/tables/${table._id}`, { status });
      fetchTables();
    } catch (err) {
      setAlert("Statusni o'zgartirishda xatolik");
    }
  };

  const categoryKeys = useMemo(() => {
    const base = new Set(Object.keys(CATEGORY_LABELS));
    tables.forEach((table) => {
      const key = (table.category || "").trim().toLowerCase();
      if (key) base.add(key);
    });
    return Array.from(base);
  }, [tables]);

  const categories = useMemo(() => [
    { key: "all", label: "Hammasi" },
    ...categoryKeys.map((key) => ({ key, label: formatCategoryLabel(key) })),
  ], [categoryKeys]);

  const categoryLabelLookup = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => {
      if (cat.key !== "all") map.set(cat.key, cat.label);
    });
    return map;
  }, [categories]);

  useEffect(() => {
    if (!categoryKeys.length) return;
    if (!categoryKeys.includes(newCategory)) {
      setNewCategory(categoryKeys[0] || DEFAULT_CATEGORY_KEY);
    }
  }, [categoryKeys, newCategory]);

  useEffect(() => {
    if (user?.role === "admin" && activeCategory !== "all") {
      setNewCategory(activeCategory);
    }
  }, [activeCategory, user?.role]);

  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => setAlert(""), 4000);
    return () => clearTimeout(timer);
  }, [alert]);

  const filteredTables = useMemo(() => {
    return tables.filter((table) => {
      const categoryKey = (table.category || DEFAULT_CATEGORY_KEY).trim().toLowerCase();
      const matchesCategory = activeCategory === "all" || categoryKey === activeCategory;
      return matchesCategory;
    });
  }, [tables, activeCategory]);

  return (
    <div className="page-shell tables-shell">
      <header className="page-header tables-header">
      
        <div className="tables-meta">
          <span className="badge badge--primary">Jami: {tables.length}</span>
        </div>
      </header>

      {user?.role === "admin" && (
        <div className="glass-panel table-add-panel">
          <input
            type="text"
            placeholder="Yangi stol nomi"
            value={newTable}
            onChange={(e) => setNewTable(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="table-category-select"
          >
            {categories
              .filter((cat) => cat.key !== "all")
              .map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
          </select>
          <button className="btn-primary" onClick={handleCreate}>
            Qo‘shish
          </button>
        </div>
      )}

      {(user?.role === "admin" || user?.role === "ofitsiant") && (
        <div className="table-categories">
          {categories.map((cat) => (
            <button
              key={cat.key}
              className={`table-category-btn${activeCategory === cat.key ? " active" : ""}`}
              onClick={() => setActiveCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {alert && <div className="alert tables-alert">{alert}</div>}

      <section className="table-grid">
        {loading ? (
          <div className="tables-empty">Yuklanmoqda...</div>
        ) : filteredTables.length === 0 ? (
          <div className="tables-empty">Hozircha stol yo‘q</div>
        ) : (
          filteredTables.map((table) => {
            const status = table.status || "free";
            const tableCode = table._id ? table._id.slice(-4).toUpperCase() : "----";
            const categoryKey = (table.category || DEFAULT_CATEGORY_KEY).trim().toLowerCase();
            const categoryLabel = categoryLabelLookup.get(categoryKey);
            const assignedRaw = table.assignedTo?._id || table.assignedTo;
            const assignedId = typeof assignedRaw === "string" ? assignedRaw : assignedRaw?.toString();
            const currentUserId = user?._id ? String(user._id) : null;
            const isOwnedByUser = Boolean(assignedId && currentUserId && assignedId === currentUserId);
            const isLockedForUser = Boolean(
              user?.role === "ofitsiant" && assignedId && currentUserId && assignedId !== currentUserId,
            );
            const assignedName = table.assignedTo?.name || table.assignedToName || "";
            return (
              <article
                key={table._id}
                className={`glass-card table-card status-${status} ${
                  activeTableId === table._id ? "active" : ""
                }${isLockedForUser ? " locked" : ""}${isOwnedByUser ? " owned" : ""}`}
                onClick={() => handleTableClick(table)}
              >
                <div className="table-card-header">
                  <span className="table-name">{table.name || "Stol"}</span>
                  <span className={`status-pill status-${status}`}>
                    {statusLabels[status] || status}
                  </span>
                </div>
                <div className="table-card-meta">
                  <p className="table-id">#{tableCode}</p>
                  {categoryLabel && <span className="table-category-chip">{categoryLabel}</span>}
                </div>

                {assignedName && (
                  <div className={`table-assignment${isLockedForUser ? " locked" : ""}${isOwnedByUser ? " own" : ""}`}>
                    <span className="table-assignment-label">Ofitsiant</span>
                    <strong className="table-assignment-name">
                      {isOwnedByUser ? `Siz — ${assignedName}` : assignedName}
                    </strong>
                    {isLockedForUser && (
                      <span className="table-assignment-note">Boshqa ofitsiant buyurtma qabul qilmoqda</span>
                    )}
                    {isOwnedByUser && (
                      <span className="table-assignment-note">Sizga biriktirilgan stol</span>
                    )}
                  </div>
                )}

                {user?.role === "admin" && (
                  <div className="table-admin-actions">
                    <button
                      className="table-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(table);
                      }}
                    >
                      Tahrirlash
                    </button>
                    <button
                      className="table-action-btn danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(table._id);
                      }}
                    >
                      O‘chirish
                    </button>
                    <button
                      className="table-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextStatus = status === "free" ? "occupied" : "free";
                        handleStatusChange(table, nextStatus);
                      }}
                    >
                      {status === "free" ? "Band" : "Bo‘sh"}
                    </button>
                    <button
                      className="table-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextStatus = status === "reserved" ? "free" : "reserved";
                        handleStatusChange(table, nextStatus);
                      }}
                    >
                      {status === "reserved" ? "Bekor" : "Rezerv"}
                    </button>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Stolni o'zgartirish</h3>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Stol nomi"
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleEditSave}>
                Saqlash
              </button>
              <button className="btn-ghost" onClick={() => setShowEditModal(false)}>
                Bekor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}