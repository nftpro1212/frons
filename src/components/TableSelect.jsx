import React from "react";
import { useNavigate } from "react-router-dom";
import "./TableSelect.css";

const TableSelect = ({ tables, selectedTable, onSelect }) => {
  const navigate = useNavigate();

  const handleTableClick = (table) => {
    onSelect && onSelect(table);
    navigate(`/kassa?table=${table._id}`);
  };

  return (
    <div className="table-select glassmorphism">
      <h3>Stollar</h3>
      <div className="table-grid">
        {tables.map((table) => (
          <button
            key={table._id}
            className={`table-btn${selectedTable && selectedTable._id === table._id ? " selected" : ""}`}
            onClick={() => handleTableClick(table)}
          >
            {table.name}
            <span className={`status-badge ${table.status}`}>{table.status}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TableSelect;
