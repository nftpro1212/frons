import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./SelectUser.css";
import "./PinModal.css";

export default function PinLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pinLogin } = useAuth();

  const user = location.state?.user;
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!user) navigate("/select-user");
  }, [user, navigate]);

  const handleLogin = async () => {
    if (!user) return;
    try {
      await pinLogin(user.id || user._id, pin);
      navigate("/");
    } catch (err) {
      alert(err?.response?.data?.message || "PIN xato!");
    }
  };

  return (
    <div className="select-user-container">
      <div className="pin-modal" style={{ position: 'relative', background: 'transparent' }}>
        <div className="pin-box glass">
          <h2>{user?.name}</h2>
          <p className="pin-helper">4-6 xonali PIN kodni kiriting</p>

          {/* PIN Display */}
          <div className="pin-display">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`}>
                {i < pin.length ? '●' : '○'}
              </div>
            ))}
          </div>

          {/* Numeric Keypad */}
          <div className="pin-keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                className="keypad-btn"
                onClick={() => {
                  if (pin.length < 6) {
                    setPin(pin + num);
                  }
                }}
              >
                {num}
              </button>
            ))}
            <button
              className="keypad-btn clear-btn"
              onClick={() => setPin('')}
            >
              C
            </button>
            <button
              className="keypad-btn"
              onClick={() => {
                if (pin.length < 6) {
                  setPin(pin + '0');
                }
              }}
            >
              0
            </button>
            <button
              className="keypad-btn backspace-btn"
              onClick={() => setPin(pin.slice(0, -1))}
            >
              ⌫
            </button>
          </div>

          {/* Action Buttons */}
          <div className="pin-buttons">
            <button className="secondary" onClick={() => navigate("/select-user")}>
              Orqaga
            </button>
            <button onClick={handleLogin} disabled={pin.length < 4}>
              Kirish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

