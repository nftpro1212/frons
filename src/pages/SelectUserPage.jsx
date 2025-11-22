import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../shared/api";
import "./SelectUser.css";
import "./PinModal.css";

const ROLE_LABELS = {
  admin: "Administrator",
  kassir: "Kassir",
  ofitsiant: "Ofitsiant",
  oshpaz: "Oshpaz",
};

const ROLE_ORDER = ["admin", "kassir", "ofitsiant", "oshpaz"];

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "ST";

export default function SelectUserPage() {
  const { pinLogin, logout } = useAuth();
  const navigate = useNavigate();

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [pinError, setPinError] = useState("");
  const tokenErrorPatterns = useMemo(() => ["token invalid", "token expired"], []);

  const handleLogout = useCallback(() => {
    logout();
    setSelectedUser(null);
    setModalOpen(false);
    setPin("");
    setPinError("");
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/auth/staff");
      setStaff(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Xodimlar ro'yxatini yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const openPinModal = (user) => {
    setSelectedUser(user);
    setPin("");
    setPinError("");
    setModalOpen(true);
  };

  const sendPin = useCallback(async () => {
    if (!selectedUser || pin.length < 4) {
      return;
    }

    try {
      const data = await pinLogin(selectedUser.id || selectedUser._id, pin);
      setModalOpen(false);
      setPinError("");

      if (data.user && data.user.role === "kassir") {
        navigate("/kassa");
      } else {
        navigate("/");
      }
    } catch (err) {
      setPinError(err?.response?.data?.message || "PIN kod noto‘g‘ri. Qayta urinib ko‘ring.");
    }
  }, [navigate, pin, pinLogin, selectedUser]);

  useEffect(() => {
    if (!modalOpen) {
      setPin("");
      setSelectedUser(null);
      setPinError("");
    }
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        setPin((prev) => {
          if (prev.length >= 6) {
            return prev;
          }

          setPinError("");
          return prev + event.key;
        });
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setPin((prev) => {
          setPinError("");
          return prev.slice(0, -1);
        });
      } else if (event.key === "Enter") {
        event.preventDefault();
        sendPin();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen, sendPin]);

  const sortedStaff = useMemo(() => {
    return staff
      .slice()
      .sort((a, b) => {
        const roleA = ROLE_ORDER.includes(a.role) ? ROLE_ORDER.indexOf(a.role) : ROLE_ORDER.length;
        const roleB = ROLE_ORDER.includes(b.role) ? ROLE_ORDER.indexOf(b.role) : ROLE_ORDER.length;

        if (roleA !== roleB) {
          return roleA - roleB;
        }

        return (a.name || "").localeCompare(b.name || "");
      });
  }, [staff]);

  const normalizedError = useMemo(() => (error ? error.toString().toLowerCase() : ""), [error]);

  return (
    <div className="select-user-view">
      <div className="select-user-content">
        <div className="select-user-head">
          <div className="select-user-headline">
            <div>
              <p className="tagline">Xodimni tanlang</p>
              <h1 className="select-user-title">PIN orqali sessiyaga ulanishingiz mumkin</h1>
              <p className="select-user-subtitle">Har bir xodim o‘z PIN kodi bilan tizimga kiradi. Ish yakunlangach sessiyani yopishni unutmang.</p>
            </div>
            <button type="button" className="session-end-btn" onClick={handleLogout}>
              <span aria-hidden="true">⏏️</span>
              <span>Tizimdan chiqish</span>
            </button>
          </div>
        </div>

        {loading && <div className="select-user-status">Xodimlar ro‘yxati yuklanmoqda...</div>}

        {!loading && error && (
          <div className="select-user-status error">
            <span>{error}</span>
            {tokenErrorPatterns.some((pattern) => normalizedError.includes(pattern)) ? (
              <button type="button" onClick={handleLogout}>
                Chiqish
              </button>
            ) : (
              <button type="button" onClick={loadStaff}>
                Qayta urinish
              </button>
            )}
          </div>
        )}

        {!loading && !error && (
          <div className="select-user-grid">
            {sortedStaff.length === 0 && <div className="select-user-empty">Xodimlar topilmadi</div>}

            {sortedStaff.map((user) => {
              const initials = getInitials(user.name);

              return (
                <button
                  key={user.id || user._id}
                  type="button"
                  className="select-user-card"
                  onClick={() => openPinModal(user)}
                >
                  <span className="select-user-avatar" aria-hidden="true">
                    {initials}
                  </span>
                  <span className="select-user-name">{user.name}</span>
                  <span className="select-user-role" data-role={user.role}>
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                  <div className="select-user-meta">
                    <span>
                      <strong>ID:</strong> {user.code || user.staffId || user._id?.slice(-6) || "-"}
                    </span>
                    <span>PINI orqali kirish</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="select-user-footer">ZarPOS Secure Access</div>
      </div>

      {modalOpen && (
        <div className="pin-modal" role="dialog" aria-modal="true">
          <div className="pin-box">
            <h2 className="pin-title">{selectedUser?.name}</h2>
            <p className="pin-helper">4-6 xonali PIN kodni kiriting</p>

            {pinError && <div className="pin-error">{pinError}</div>}

            <div className="pin-display" aria-live="polite">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className={`pin-dot ${index < pin.length ? "filled" : ""}`}>
                  {index < pin.length ? "●" : "○"}
                </div>
              ))}
            </div>

            <div className="pin-keypad">
              {Array.from({ length: 9 }).map((_, index) => {
                const value = (index + 1).toString();

                return (
                  <button
                    key={value}
                    type="button"
                    className="keypad-btn"
                    onClick={() => {
                      if (pin.length < 6) {
                        setPin((prev) => prev + value);
                        setPinError("");
                      }
                    }}
                  >
                    {value}
                  </button>
                );
              })}
              <button
                type="button"
                className="keypad-btn clear-btn"
                onClick={() => {
                  setPin("");
                  setPinError("");
                }}
              >
                C
              </button>
              <button
                type="button"
                className="keypad-btn"
                onClick={() => {
                  if (pin.length < 6) {
                    setPin((prev) => prev + "0");
                    setPinError("");
                  }
                }}
              >
                0
              </button>
              <button
                type="button"
                className="keypad-btn backspace-btn"
                onClick={() => {
                  setPin((prev) => prev.slice(0, -1));
                  setPinError("");
                }}
              >
                ⌫
              </button>
            </div>

            <div className="pin-buttons">
              <button type="button" className="secondary" onClick={() => setModalOpen(false)}>
                Bekor qilish
              </button>
              <button type="button" onClick={sendPin} disabled={pin.length < 4}>
                Kirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
