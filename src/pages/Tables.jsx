import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTable } from "../context/TableContext.jsx";
import api from "../shared/api";
import "./Tables.css";

const statusLabels = { free: "Bo‘sh", occupied: "Band", reserved: "Rezerv" };

const tableCategories = [
  { key: "all", label: "Hammasi" },
  { key: "zal", label: "Zal" },
  { key: "kabina", label: "Kabina" },
  { key: "tapchan", label: "Tapchan" },
  { key: "zal2", label: "Zal 2" },
];

export default function TablesPage() {
  const { token, user } = useAuth();
  const { setSelectedTable } = useTable();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState("");
  const [newTable, setNewTable] = useState("");
  const [newCategory, setNewCategory] = useState(tableCategories[1]?.key || "zal");
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

  const fetchTables = async () => {
    setLoading(true);
    try {
      const res = await api.get("/tables");
      setTables(res.data);
      setAlert("");
    } catch (err) {
      setAlert("Stollarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  const handleTableClick = (table) => {
    setActiveTableId(table._id);
    setSelectedTable({ id: table._id, name: table.name, status: table.status });
    navigate("/menu");
  };

  const handleCreate = async () => {
    if (!newTable.trim()) return;
    try {
      await api.post("/tables", { name: newTable.trim(), category: newCategory });
      setNewTable("");
      setNewCategory(tableCategories[1]?.key || "zal");
      fetchTables();
      setAlert("Yangi stol qo‘shildi");
    } catch (err) {
      setAlert("Stol yaratishda xato");
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

  const filteredTables = user?.role === "ofitsiant"
    ? tables.filter(t => activeCategory === "all" || (t.category || "zal").toLowerCase() === activeCategory)
    : tables;

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
            {tableCategories
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

      {user?.role === "ofitsiant" && (
        <div className="table-categories">
          {tableCategories.map((cat) => (
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
            return (
              <article
                key={table._id}
                className={`glass-card table-card status-${status} ${
                  activeTableId === table._id ? "active" : ""
                }`}
                onClick={() => handleTableClick(table)}
              >
                <div className="table-card-header">
                  <span className="table-name">{table.name || "Stol"}</span>
                  <span className={`status-pill status-${status}`}>
                    {statusLabels[status] || status}
                  </span>
                </div>
                <p className="table-id">#{tableCode}</p>

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