import React from "react";
import "./TableSelect.css";

const TableGrid = ({ tables, onTableClick }) => (
  <div className="table-select glassmorphism">
    <h3>Stollar</h3>
    <div className="table-grid">
      {tables.map((table) => (
        <button
          key={table._id}
          className={`table-btn`}
          onClick={() => onTableClick(table)}
          disabled={table.status === "occupied"}
        >
          {table.name}
          <span className={`status-badge ${table.status}`}>{table.status}</span>
        </button>
      ))}
    </div>
  </div>
);

export default TableGrid;
