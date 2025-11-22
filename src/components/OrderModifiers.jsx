import React, { useState } from "react";
import "./OrderModifiers.css";

const availableModifiers = [
  { name: "Qo'shimcha pishloq", price: 3000 },
  { name: "Kam tuz", price: 0 },
  { name: "Achchiq sous", price: 2000 },
  { name: "Mayonez", price: 1500 },
];

const OrderModifiers = ({ order, onChange }) => {
  const [modState, setModState] = useState({});

  if (!order || !order.items || order.items.length === 0) {
    return (
      <div className="order-modifiers glassmorphism">
        <h3>Mahsulot modifikatorlari</h3>
        <div>Buyurtma tanlanmagan</div>
      </div>
    );
  }

  const handleModifierToggle = (itemIdx, modIdx) => {
    const key = `${itemIdx}-${modIdx}`;
    setModState((prev) => {
      const newState = { ...prev };
      if (newState[key]) delete newState[key];
      else newState[key] = true;
      return newState;
    });
    // TODO: onChange bilan backendga ham uzatish mumkin
  };

  return (
    <div className="order-modifiers glassmorphism">
      <h3>Mahsulot modifikatorlari</h3>
      {order.items.map((item, itemIdx) => (
        <div key={itemIdx} className="modifier-item-block">
          <div className="modifier-item-title">
            {item.name}{" "}
            <span style={{ color: "#ff003c" }}>x{item.qty}</span>
          </div>
          <div className="modifier-btn-group">
            {availableModifiers.map((mod, modIdx) => (
              <button
                key={modIdx}
                className={`modifier-btn${
                  modState[`${itemIdx}-${modIdx}`] ? " selected" : ""
                }`}
                onClick={() => handleModifierToggle(itemIdx, modIdx)}
                type="button"
              >
                {mod.name} {mod.price > 0 ? `(+${mod.price} so'm)` : ""}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default OrderModifiers;
