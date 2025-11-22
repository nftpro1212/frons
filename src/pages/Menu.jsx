// src/pages/MenuPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTable } from "../context/TableContext.jsx";
import useSocket from "../hooks/useSocket";
import api from "../shared/api";
import defaultFoodImg from "../assets/images/default-food.png";
import "./Menu.css";

const emptyDraft = { name: "", category: "", description: "", price: "", image: null };

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

  useEffect(() => {
    if (!token) return;
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    loadMenu();
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
    setEditDraft(emptyDraft);
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
        });
      } else {
        await api.put(`/menu/${editItem._id}`, {
          name: editDraft.name,
          category: editDraft.category,
          description: editDraft.description,
          price: parseFloat(editDraft.price),
          imageUrl,
        });
      }
      setShowEditModal(false);
      setEditItem(null);
      setEditDraft(emptyDraft);
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