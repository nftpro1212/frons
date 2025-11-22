import React, { createContext, useContext, useState } from "react";

const TableContext = createContext();

export const useTable = () => useContext(TableContext);

export function TableProvider({ children }) {
  const [selectedTable, setSelectedTable] = useState(null);

  return (
    <TableContext.Provider value={{ selectedTable, setSelectedTable }}>
      {children}
    </TableContext.Provider>
  );
}
