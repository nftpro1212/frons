import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { FiClock, FiTrendingUp, FiUsers } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import "./login.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [kbdVisible, setKbdVisible] = useState(false);
  const [activeInput, setActiveInput] = useState(null); // "username" | "password" | null
  const [capsLock, setCapsLock] = useState(false);
  const [pressedKey, setPressedKey] = useState(null);
  const keyboardRef = useRef(null);

  const highlightCards = useMemo(
    () => [
      {
        key: "uptime",
        icon: <FiTrendingUp />,
        title: "Analitika",
        description: "Jonli savdo va buyurtma dinamikasi"
      },
      {
        key: "speed",
        icon: <FiClock />,
        title: "Tezkor kirish",
        description: "PIN yoki katta klaviatura orqali login"
      },
      {
        key: "team",
        icon: <FiUsers />,
        title: "Jamoa rejimi",
        description: "Rolga mos panel va ish jarayoni"
      }
    ],
    []
  );

  // POS uchun katta klaviatura
  const rows = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "backspace"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", "enter"],
    ["caps", "z", "x", "c", "v", "b", "n", "m", ",", ".", "@"],
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "hide"],
    ["space"]
  ];

  // Klaviatura balandligi
  useEffect(() => {
    const h = kbdVisible ? "58vh" : "0vh";
    document.documentElement.style.setProperty("--zar-kbd-height", h);
  }, [kbdVisible]);

  // Escape → yopish
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && (setKbdVisible(false), setActiveInput(null));
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  const pressVisual = (k) => {
    setPressedKey(k);
    setTimeout(() => setPressedKey(null), 180);
  };

  const appendChar = (ch) => {
    const char = capsLock ? ch.toUpperCase() : ch.toLowerCase();
    if (activeInput === "username") setUsername((s) => s + char);
    if (activeInput === "password") setPassword((s) => s + char);
  };

  const handleKey = (key) => {
    pressVisual(key);

    if (key === "hide") {
      setKbdVisible(false);
      setActiveInput(null);
      return;
    }
    if (key === "backspace") {
      if (activeInput === "username") setUsername((s) => s.slice(0, -1));
      if (activeInput === "password") setPassword((s) => s.slice(0, -1));
      return;
    }
    if (key === "caps") {
      setCapsLock((c) => !c);
      return;
    }
    if (key === "space") {
      appendChar(" ");
      return;
    }
    if (key === "enter") {
      // Agar login yozilayotgan bo‘lsa → parol maydoniga o‘tish
      if (activeInput === "username") {
        setActiveInput("password");
        // Klaviatura ochiq qoladi
      } else {
        // Agar parol yozilayotgan bo‘lsa → formani yuborish
        document.getElementById("zar-login-form")?.requestSubmit();
      }
      return;
    }
    appendChar(key);
  };

  const focusInput = (name) => {
    setActiveInput(name);
    setKbdVisible(true);
  };

  const submit = async (e) => {
    if (e) e.preventDefault();
    try {
      await login(username.trim(), password);
      navigate("/select-user");
    } catch (err) {
      alert(err?.response?.data?.message || "Login yoki parol xato");
    }
  };

  return (
    <div className="pos-login-root">
      {/* Top area */}
      <motion.div
        className="login-top"
        style={{ paddingBottom: "calc(var(--zar-kbd-height, 0px) + 30px)" }}
        animate={{ y: kbdVisible ? -120 : 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
      >
        <motion.div
          className="login-card glass"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <motion.div className="login-card-grid">
            <motion.div
              className="login-intro"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.45 }}
            >
              <div className="brand-row">
                <div className="zar-logo" aria-hidden>
                  <svg width="76" height="76" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="g1" x1="0" x2="1">
                        <stop offset="0" stopColor="#FF2F47" />
                        <stop offset="1" stopColor="#FF6A5F" />
                      </linearGradient>
                    </defs>
                    <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#g1)" opacity="0.95" />
                    <path d="M18 44 L30 18 L38 44 Z" fill="#1b1b20" opacity="0.95" />
                    <path d="M26 28 L36 28 L31 36 Z" fill="#FFCDD6" opacity="0.15" />
                  </svg>
                </div>
                <div className="brand-texts">
                  <div className="brand-title">ZarPos</div>
                  <div className="brand-sub">Smart Restaurant POS</div>
                </div>
              </div>
              <p className="login-subtitle">
                Yagona platforma orqali stollar, buyurtmalar va to‘lovlarni bir zumda boshqaring. Kassir va ofitsiantlar uchun optimallashtirilgan ish maydoni.
              </p>
              <div className="login-highlights">
                {highlightCards.map(({ key, icon, title, description }) => (
                  <div key={key} className="login-highlight-card">
                    <span className="login-highlight-icon" aria-hidden>
                      {icon}
                    </span>
                    <div>
                      <p className="login-highlight-title">{title}</p>
                      <p className="login-highlight-desc">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <form id="zar-login-form" onSubmit={submit} className="form-area login-form">
              <motion.h2
                className="login-form-title"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.4 }}
              >
                Tizimga kirish
              </motion.h2>
              <motion.p
                className="login-form-helper"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.27, duration: 0.4 }}
              >
                Foydalanuvchi nomi va parolingizni kiriting. 
              </motion.p>

              <motion.label
                className="input-label"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
              >
                Login
              </motion.label>
              <motion.div
                className={`pos-input ${activeInput === "username" ? "focused" : ""}`}
                onClick={() => focusInput("username")}
                role="button"
                tabIndex={0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
              >
                <div className="input-text">
                  {username || <span className="placeholder">Foydalanuvchi nomi</span>}
                </div>
              </motion.div>

              <motion.label
                className="input-label"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
              >
                Parol
              </motion.label>
              <motion.div
                className={`pos-input ${activeInput === "password" ? "focused" : ""}`}
                onClick={() => focusInput("password")}
                role="button"
                tabIndex={0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.4 }}
              >
                <div className="input-text">
                  {password ? "•".repeat(password.length) : <span className="placeholder">Parolni kiriting</span>}
                </div>
              </motion.div>

              <motion.button
                className="btn-primary login-submit"
                type="submit"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.4 }}
              >
                Kirish
              </motion.button>
              <motion.div
                className="login-meta-note"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.62, duration: 0.45 }}
              >
                ZarPOS 3.1 — xavfsiz va tezkor restoran boshqaruvi.
              </motion.div>
            </form>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* KATTA KLAVIATURA */}
      <AnimatePresence>
        {kbdVisible && (
          <motion.div
            ref={keyboardRef}
            className="pos-keyboard"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            aria-hidden={!kbdVisible}
          >
            <div className="kbd-inner">
              {rows.map((row, rIdx) => (
                <motion.div
                  key={rIdx}
                  className="kbd-row"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: rIdx * 0.06, duration: 0.35 }}
                >
                  {row.map((k) => {
                    const isSpecial = ["backspace", "caps", "space", "enter", "hide"].includes(k);
                    const isSpace = k === "space";
                    const isCaps = k === "caps";
                    const isBackspace = k === "backspace";
                    const isEnter = k === "enter";

                    // Harfni CapsLock bo‘yicha ko‘rsatish
                    const displayChar = k.length === 1 ? (capsLock ? k.toUpperCase() : k.toLowerCase()) : k;

                    const cls = [
                      "kbd-key",
                      isSpecial ? "kbd-key--special" : "kbd-key--char",
                      isSpace ? "kbd-key--space" : "",
                      pressedKey === k ? "kbd-key--pressed" : "",
                      isCaps && capsLock ? "kbd-key--active" : "",
                    ].join(" ");

                    return (
                      <motion.button
                        key={`${k}-${rIdx}`}
                        className={cls}
                        onClick={() => handleKey(k)}
                        aria-label={`key-${k}`}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                      >
                        {isSpace ? (
                          <span className="kbd-space-text">BO‘SH JOY</span>
                        ) : isCaps ? (
                          <span className="kbd-caps-text">CAPS</span>
                        ) : isBackspace ? (
                          <span className="kbd-backspace-icon">X</span>
                        ) : isEnter ? (
                          <span className="kbd-enter-icon">ENTER</span>
                        ) : (
                          displayChar
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
