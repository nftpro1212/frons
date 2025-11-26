// src/pages/MenuPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTable } from "../context/TableContext.jsx";
import useSocket from "../hooks/useSocket";
import api from "../shared/api";
import defaultFoodImg from "../assets/images/default-food.png";
import "./Menu.css";

const emptyDraft = {
  name: "",
  category: "",
  description: "",
  price: "",
  image: null,
  productionPrinterIds: [],
};

export default function MenuPage() {
  const { user, token } = useAuth();
  const { selectedTable } = useTable();
  const isWaiter = user?.role === "ofitsiant";
  const isAdmin = user?.role === "admin";

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

  const socket = useSocket();

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

  // Table Orders (foydalanuvchi uchun ko‘rinmaydi, faqat fon)
  const fetchTableOrders = async () => {
    if (!selectedTable) return;
    try {
      await api.get("/orders", { params: { tableId: selectedTable.id } });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token && selectedTable) fetchTableOrders();
  }, [token, selectedTable]);

  useEffect(() => {
    if (!socket || !selectedTable) return;
    const refresh = () => fetchTableOrders();
    socket.on("order:new", refresh);
    socket.on("order:updated", refresh);
    return () => {
      socket.off("order:new", refresh);
      socket.off("order:updated", refresh);
    };
  }, [socket, selectedTable]);

  const handleSearch = () => loadMenu(query.trim());

  const priceFormatter = useMemo(() => new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }), []);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(menu.map((i) => i.category || "Barchasi")));
    return ["Barchasi", ...unique.filter((c) => c !== "Barchasi")];
  }, [menu]);

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

  const addToCart = (item) => {
    if (!isWaiter) return;
    setCart((prev) => {
      const exists = prev.find((c) => c.menuItem === item._id);
      if (exists) return prev.map((c) => (c.menuItem === item._id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { menuItem: item._id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((c) => c.menuItem !== id));

  const handleConfirmCart = async () => {
    if (!selectedTable || !cart.length) return;
    try {
      await api.post("/orders", {
        tableId: selectedTable.id,
        tableName: selectedTable.name,
        items: cart,
      });
      setCart([]);
      fetchTableOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddClick = () => {
    setAddMode(true);
    setEditItem(null);
    setEditDraft({ ...emptyDraft, productionPrinterIds: [] });
    setShowEditModal(true);
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
      if (addMode) {
        await api.post(`/menu`, {
          name: editDraft.name,
          category: editDraft.category,
          description: editDraft.description,
          price: parseFloat(editDraft.price),
          imageUrl,
          productionPrinterIds: editDraft.productionPrinterIds,
        });
      } else {
        await api.put(`/menu/${editItem._id}`, {
          name: editDraft.name,
          category: editDraft.category,
          description: editDraft.description,
          price: parseFloat(editDraft.price),
          imageUrl,
          productionPrinterIds: editDraft.productionPrinterIds,
        });
      }
      setShowEditModal(false);
      setEditItem(null);
      setEditDraft({ ...emptyDraft, productionPrinterIds: [] });
      setAddMode(false);
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
            <h3>Savat</h3>
            {cart.length === 0 ? (
              <p className="empty-cart">Savat bo‘sh</p>
            ) : (
              <>
                <ul className="cart-items">
                  {cart.map((item) => (
                    <li key={item.menuItem}>
                      <div>
                        <strong>{item.qty}x</strong> {item.name}
                      </div>
                      <div className="cart-price">
                        {priceFormatter.format(item.price * item.qty)} so‘m
                        <button onClick={() => removeFromCart(item.menuItem)}>×</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="cart-total">
                  <strong>Jami:</strong>{" "}
                  {priceFormatter.format(cart.reduce((a, c) => a + c.price * c.qty, 0))} so‘m
                </div>
                {window.location.pathname === "/delivery" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className={orderType === "delivery" ? "confirm-btn active" : "confirm-btn"} onClick={() => { setOrderType("delivery"); handleConfirmCart(); }}>Dostavka</button>
                    <button className={orderType === "soboy" ? "confirm-btn active" : "confirm-btn"} onClick={() => { setOrderType("soboy"); handleConfirmCart(); }}>Soboy</button>
                  </div>
                ) : (
                  <button className="confirm-btn" onClick={handleConfirmCart}>
                    Oshxonaga yuborish
                  </button>
                )}
              </>
            )}
          </aside>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setAddMode(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{addMode ? "Yangi taom qo'shish" : "Taomni tahrirlash"}</h3>
            <input
              value={editDraft.name}
              onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
              placeholder="Nomi"
            />
            <input
              value={editDraft.category}
              onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
              placeholder="Kategoriya"
            />
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
              <button onClick={() => { setShowEditModal(false); setAddMode(false); }}>Bekor qilish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}