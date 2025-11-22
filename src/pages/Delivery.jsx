import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiCoffee,
  FiPrinter,
  FiRefreshCcw,
  FiSearch,
  FiShoppingBag,
  FiShoppingCart,
  FiTag,
  FiTruck,
} from "react-icons/fi";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../shared/api";
import defaultFoodImg from "../assets/images/default-food.png";
import { printCheck, downloadCheckAsHTML } from "../utils/checkPrinter";
import "./Delivery.css";

const ROLE_WITH_ACCESS = ["ofitsiant", "admin", "kassir"];

const DeliveryPage = () => {
  const { user, token } = useAuth();
  const canManageOrders = ROLE_WITH_ACCESS.includes(user?.role);

  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Barchasi");
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState("delivery");
  const [feedback, setFeedback] = useState(null);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(true);
  const [showCheckAfterOrder, setShowCheckAfterOrder] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [lastOrderType, setLastOrderType] = useState("delivery");
  const [submitting, setSubmitting] = useState(false);

  const priceFormatter = useMemo(() => new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }), []);

  const loadMenu = useCallback(async (search = "") => {
    setLoading(true);
    try {
      const params = search ? { q: search } : {};
      const res = await api.get("/menu", { params });
      setMenu(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Menyu yuklanmadi:", error);
      setFeedback({ type: "error", text: "Menyu ma'lumotlarini yuklashda xatolik" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    loadMenu();
  }, [token, loadMenu]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = setTimeout(() => setFeedback(null), feedback.type === "error" ? 5200 : 3200);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const handleSearch = useCallback(() => {
    loadMenu(query.trim());
  }, [loadMenu, query]);

  const handleSearchKey = useCallback(
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSearch();
      }
    },
    [handleSearch]
  );

  const handleClearSearch = useCallback(() => {
    setQuery("");
    loadMenu("");
  }, [loadMenu]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set((menu || []).map((item) => item?.category || "Barchasi")));
    return ["Barchasi", ...unique.filter((category) => category !== "Barchasi")];
  }, [menu]);

  const filteredMenu = useMemo(() => {
    if (activeCategory === "Barchasi") return menu;
    return (menu || []).filter((item) => (item?.category || "Barchasi") === activeCategory);
  }, [menu, activeCategory]);

  const cartTotals = useMemo(() => {
    const total = cart.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0);
    const itemCount = cart.reduce((count, item) => count + (item.qty || 0), 0);
    return { total, itemCount };
  }, [cart]);

  const metrics = useMemo(() => {
    const categoryCount = Math.max(categories.length - 1, 0);
    return [
      {
        id: "menu",
        label: "Menyu pozitsiyalari",
        value: menu.length.toString(),
        sub: "Umumiy taomlar soni",
        icon: <FiCoffee />,
      },
      {
        id: "categories",
        label: "Turkumlar",
        value: categoryCount.toString(),
        sub: "Faol kategoriyalar",
        icon: <FiTag />,
      },
      {
        id: "filtered",
        label: "Filtr natijasi",
        value: filteredMenu.length.toString(),
        sub: `${activeCategory} ko‘rinmoqda`,
        icon: <FiSearch />,
      },
      {
        id: "cart",
        label: "Savatdagi mahsulotlar",
        value: cartTotals.itemCount.toString(),
        sub: `${priceFormatter.format(cartTotals.total)} so'm`,
        icon: <FiShoppingCart />,
      },
    ];
  }, [activeCategory, cartTotals, categories.length, filteredMenu.length, menu.length, priceFormatter]);

  const addToCart = useCallback(
    (item) => {
      if (!canManageOrders) return;
      setCart((prev) => {
        const existing = prev.find((cartItem) => cartItem.menuItem === item._id);
        if (existing) {
          return prev.map((cartItem) =>
            cartItem.menuItem === item._id ? { ...cartItem, qty: cartItem.qty + 1 } : cartItem
          );
        }
        return [
          ...prev,
          { menuItem: item._id, name: item.name, price: item.price, qty: 1, notes: item.notes || "" },
        ];
      });
    },
    [canManageOrders]
  );

  const updateCartQty = useCallback((id, qty) => {
    setCart((prev) => {
      if (qty <= 0) {
        return prev.filter((item) => item.menuItem !== id);
      }
      return prev.map((item) => (item.menuItem === id ? { ...item, qty } : item));
    });
  }, []);

  const removeFromCart = useCallback((id) => {
    setCart((prev) => prev.filter((item) => item.menuItem !== id));
  }, []);

  const handleConfirmCart = useCallback(async () => {
    if (!canManageOrders) {
      setFeedback({ type: "error", text: "Sizda buyurtma yuborish huquqi yo'q" });
      return;
    }

    if (!cart.length) {
      setFeedback({ type: "info", text: "Savat hozircha bo'sh" });
      return;
    }

    setSubmitting(true);
    const currentType = orderType;

    try {
      const response = await api.post("/orders", {
        items: cart,
        isDelivery: currentType === "delivery",
        type: currentType,
        customer: null,
      });

      const createdOrder = response.data;
      setLastOrder(createdOrder);
      setLastOrderType(currentType);
      setCart([]);
      setShowCheckAfterOrder(true);
      setFeedback({ type: "success", text: "Buyurtma oshxonaga yuborildi" });

      if (autoPrintEnabled) {
        setTimeout(() => {
          const checkData = {
            ...createdOrder,
            tableName: currentType === "delivery" ? "Dostavka" : "Soboy",
            items: createdOrder.items || [],
            total: createdOrder.total || 0,
            subtotal: createdOrder.subtotal || 0,
            tax: createdOrder.tax || 0,
            discount: createdOrder.discount || 0,
          };
          printCheck(checkData, {});
        }, 600);
      }
    } catch (error) {
      console.error("Buyurtmani yuborishda xato:", error);
      setFeedback({ type: "error", text: "Buyurtmani yuborishda xato yuz berdi" });
    } finally {
      setSubmitting(false);
    }
  }, [autoPrintEnabled, canManageOrders, cart, orderType]);

  const handleDownloadCheck = useCallback(() => {
    if (!lastOrder) return;
    const checkData = {
      ...lastOrder,
      tableName: lastOrderType === "delivery" ? "Dostavka" : "Soboy",
      items: lastOrder.items || [],
      total: lastOrder.total || 0,
      subtotal: lastOrder.subtotal || 0,
      tax: lastOrder.tax || 0,
      discount: lastOrder.discount || 0,
    };
    downloadCheckAsHTML(checkData, {});
  }, [lastOrder, lastOrderType]);

  return (
    <div className="delivery-screen page-shell page-shell--full-width">
      <header className="delivery-top">
        
        <div className="delivery-actions">
          <div className="delivery-search">
            <FiSearch className="delivery-search-icon" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKey}
              placeholder="Taom yoki kategoriya nomi..."
            />
            {query && (
              <button type="button" className="delivery-search-clear" onClick={handleClearSearch}>
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            className={`delivery-refresh${loading ? " is-busy" : ""}`}
            onClick={() => handleSearch()}
          >
            <FiRefreshCcw />
            Yangilash
          </button>
        </div>
      </header>

      <section className="delivery-metrics">
        {metrics.map((metric) => (
          <article key={metric.id} className="delivery-metric-card">
            <span className="metric-icon">{metric.icon}</span>
            <div>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
              <p>{metric.sub}</p>
            </div>
          </article>
        ))}
      </section>

      <div className="delivery-layout">
        <aside className="delivery-panel delivery-sidebar">
          <div className="delivery-type-card">
            <div className="delivery-type-head">
              <h2>Buyurtma turi</h2>
              <p>Yetkazib berish yoki soboy rejimini tanlang.</p>
            </div>
            <div className="delivery-type-buttons">
              <button
                type="button"
                className={`delivery-type-button${orderType === "delivery" ? " active" : ""}`}
                onClick={() => setOrderType("delivery")}
              >
                <span className="type-icon">
                  <FiTruck />
                </span>
                <div>
                  <strong>Dostavka</strong>
                  <span>Kuryer orqali yetkazish</span>
                </div>
              </button>
              <button
                type="button"
                className={`delivery-type-button${orderType === "soboy" ? " active" : ""}`}
                onClick={() => setOrderType("soboy")}
              >
                <span className="type-icon">
                  <FiShoppingBag />
                </span>
                <div>
                  <strong>Soboy</strong>
                  <span>Mijoz o‘zi olib ketadi</span>
                </div>
              </button>
            </div>
            <button
              type="button"
              className={`delivery-switch${autoPrintEnabled ? " active" : ""}`}
              onClick={() => setAutoPrintEnabled((prev) => !prev)}
            >
              <span className="switch-track">
                <span className="switch-thumb" />
              </span>
              <span>Chekni avtomatik chop etish</span>
            </button>
          </div>

          <div className="delivery-categories">
            <div className="delivery-categories-head">
              <FiTag />
              <h3>Kategoriyalar</h3>
            </div>
            <div className="delivery-category-scroller">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`delivery-category-btn${activeCategory === category ? " active" : ""}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="delivery-panel delivery-menu-panel">
          <div className="delivery-menu-head">
            <div>
              <h2>Menyu</h2>
              <span>{filteredMenu.length} ta pozitsiya</span>
            </div>
            {loading && <span className="delivery-status-badge">Yuklanmoqda...</span>}
          </div>
          <div className="delivery-menu-grid">
            {loading ? (
              <div className="delivery-menu-placeholder">
                <FiRefreshCcw />
                <p>Menyu ma'lumotlari yangilanmoqda</p>
              </div>
            ) : filteredMenu.length === 0 ? (
              <div className="delivery-menu-placeholder">
                <FiAlertCircle />
                <p>Natijalar topilmadi. Boshqa kategoriya yoki qidiruvni sinab ko‘ring.</p>
              </div>
            ) : (
              filteredMenu.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className="delivery-menu-card"
                  onClick={() => addToCart(item)}
                  disabled={!canManageOrders}
                >
                  <div className="delivery-menu-image">
                    <img
                      src={
                        item.imageUrl
                          ? item.imageUrl.startsWith("http")
                            ? item.imageUrl
                            : `${import.meta.env.VITE_API_URL}${item.imageUrl}`
                          : defaultFoodImg
                      }
                      alt={item.name}
                    />
                  </div>
                  <div className="delivery-menu-content">
                    <h3>{item.name}</h3>
                    <span>{priceFormatter.format(item.price || 0)} so'm</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <aside className="delivery-panel delivery-cart-panel">
          <div className="delivery-cart-head">
            <h2>
              <FiShoppingCart /> Savat
            </h2>
            <span>{cartTotals.itemCount} ta</span>
          </div>

          {feedback && (
            <div className={`delivery-alert ${feedback.type}`}>
              {feedback.type === "success" ? <FiCheckCircle /> : <FiAlertCircle />}
              <span>{feedback.text}</span>
            </div>
          )}

          {!canManageOrders ? (
            <div className="delivery-empty-cart">
              <FiAlertCircle size={32} />
              <p>Bu bo‘limdan foydalanish uchun ruxsat kerak.</p>
              <span>Administrator bilan bog‘laning.</span>
            </div>
          ) : cart.length === 0 ? (
            <div className="delivery-empty-cart">
              <FiShoppingCart size={32} />
              <p>Savat bo‘sh</p>
              <span>Menyudan taomlarni qo‘shing</span>
            </div>
          ) : (
            <>
              <ul className="delivery-cart-items">
                {cart.map((item) => (
                  <li key={item.menuItem}>
                    <div className="delivery-cart-item">
                      <div className="delivery-cart-item-info">
                        <strong>{item.name}</strong>
                        <span>{priceFormatter.format(item.price || 0)} so'm</span>
                      </div>
                      <button
                        type="button"
                        className="delivery-remove-btn"
                        onClick={() => removeFromCart(item.menuItem)}
                        aria-label={`${item.name} ni o‘chirish`}
                      >
                        ×
                      </button>
                    </div>
                    <div className="delivery-cart-controls">
                      <div className="delivery-qty">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.menuItem, item.qty - 1)}
                          aria-label="Sonini kamaytirish"
                        >
                          −
                        </button>
                        <span>{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.menuItem, item.qty + 1)}
                          aria-label="Sonini oshirish"
                        >
                          +
                        </button>
                      </div>
                      <span className="delivery-line-total">
                        {priceFormatter.format((item.price || 0) * (item.qty || 0))} so'm
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="delivery-cart-summary">
                <div>
                  <span>Umumiy summa</span>
                  <strong>{priceFormatter.format(cartTotals.total)} so'm</strong>
                </div>
                <span>{orderType === "delivery" ? "Dostavka buyurtmasi" : "Soboy buyurtmasi"}</span>
              </div>

              <button
                type="button"
                className={`delivery-confirm-btn${submitting ? " is-busy" : ""}`}
                onClick={handleConfirmCart}
                disabled={submitting}
              >
                <FiTruck />
                <span>Oshxonaga yuborish</span>
              </button>

              {showCheckAfterOrder && lastOrder && (
                <button type="button" className="delivery-secondary-btn" onClick={handleDownloadCheck}>
                  <FiPrinter />
                  <span>Chekni yuklab olish</span>
                </button>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default DeliveryPage;
