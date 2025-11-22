import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../shared/api";
import "./Payments.css";
import * as XLSX from "xlsx";

const formatCurrency = (value) =>
  new Intl.NumberFormat("uz-UZ").format(Math.round(Number(value) || 0));

export default function PaymentPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/payments");
      setPayments(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError("To‘lovlar tarixini yuklab bo‘lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const paymentSummary = useMemo(() => {
    const base = payments.reduce(
      (acc, payment) => {
        const total = Number(payment.totalAmount ?? payment.amount ?? 0) || 0;
        acc.totalAmount += total;
        acc.count += 1;

        const parts = Array.isArray(payment.parts) && payment.parts.length > 0
          ? payment.parts
          : [{ method: payment.method || "Noma'lum", amount: total }];

        parts.forEach(({ method, amount }) => {
          if (!method) return;
          const safeAmount = Number(amount ?? 0) || 0;
          acc.methods[method] = (acc.methods[method] || 0) + safeAmount;
        });

        return acc;
      },
      { totalAmount: 0, count: 0, methods: {} }
    );

    const methodList = Object.entries(base.methods)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([method, amount]) => ({ method, amount }));

    return {
      totalAmount: base.totalAmount,
      count: base.count,
      methodList,
    };
  }, [payments]);

  const exportToExcel = () => {
    const data = payments.map((p) => ({
      Sana: new Date(p.createdAt).toLocaleString(),
      Stol: p.order?.tableName || p.order?.table || "-",
      Mijoz: p.customer?.name || "-",
      "To‘lov turi": Array.isArray(p.parts) && p.parts.length > 0 ? p.parts.map(pt => pt.method).join(", ") : (p.method || "-"),
      "Summa": p.totalAmount || p.amount || "-",
      "To‘lovlar tafsiloti": Array.isArray(p.parts) && p.parts.length > 0 ? p.parts.map(pt => `${pt.method}: ${pt.amount}`).join(", ") : (p.method && p.amount ? `${p.method}: ${p.amount}` : "-"),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "To‘lovlar");
    XLSX.writeFile(wb, `tolovlar_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="page-shell payments-shell">
      <header className="page-header">
        <div>
          <p className="page-subtitle">
            Oxirgi yangilanish: {lastUpdated ? lastUpdated.toLocaleString() : "hali aniqlanmagan"}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn-ghost" onClick={fetchPayments} disabled={loading}>
            {loading ? "Yuklanmoqda..." : "Yangilash"}
          </button>
          <button
            className="btn-primary"
            onClick={exportToExcel}
            disabled={loading || payments.length === 0}
          >
            Excelga yuklash
          </button>
        </div>
      </header>

      {error && <div className="alert alert--danger">{error}</div>}

      <section className="section-grid section-grid--cols-3 payments-summary-grid">
        <div className="glass-card">
          <p className="payments-summary-label">Umumiy summa</p>
          <h3 className="payments-summary-value">{formatCurrency(paymentSummary.totalAmount)} so‘m</h3>
        </div>
        <div className="glass-card">
          <p className="payments-summary-label">Tranzaksiyalar soni</p>
          <h3 className="payments-summary-value">{paymentSummary.count}</h3>
        </div>
        <div className="glass-card">
          <p className="payments-summary-label">Eng faol metodlar</p>
          <ul className="payments-method-list">
            {paymentSummary.methodList.length === 0 && <li>Ma'lumot yo‘q</li>}
            {paymentSummary.methodList.map(({ method, amount }) => (
              <li key={method}>
                <span>{method}</span>
                <strong>{formatCurrency(amount)} so‘m</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="glass-panel payments-table-card">
        <div className="table-scroll">
          <table className="payments-table">
            <thead>
              <tr>
                <th>Sana</th>
                <th>Stol</th>
                <th>Mijoz</th>
                <th>To‘lov turi</th>
                <th>Summa</th>
                <th>To‘lovlar tafsiloti</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id}>
                  <td>{new Date(p.createdAt).toLocaleString()}</td>
                  <td>{p.order?.tableName || p.order?.table || "-"}</td>
                  <td>{p.customer?.name || "-"}</td>
                  <td>
                    {Array.isArray(p.parts) && p.parts.length > 0
                      ? p.parts.map((pt) => pt.method).join(", ")
                      : p.method || "-"}
                  </td>
                  <td>{formatCurrency(p.totalAmount || p.amount)} so‘m</td>
                  <td>
                    {Array.isArray(p.parts) && p.parts.length > 0
                      ? p.parts.map((pt) => `${pt.method}: ${formatCurrency(pt.amount)}`).join(", ")
                      : p.method && p.amount
                      ? `${p.method}: ${formatCurrency(p.amount)}`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && payments.length === 0 && (
          <div className="payments-empty">To‘lovlar tarixi yo‘q</div>
        )}
      </section>
    </div>
  );
}