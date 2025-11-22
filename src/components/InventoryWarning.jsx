import React from "react";
import "./InventoryWarning.css";

const InventoryWarning = ({ order }) => {
  // Placeholder for inventory/block warnings
  return (
    <div className="inventory-warning glassmorphism">
      <h3>Inventar va bloklangan mahsulotlar</h3>
      <div>Inventar ogohlantirishlari va bloklangan mahsulotlar shu yerda chiqadi</div>
    </div>
  );
};

export default InventoryWarning;
