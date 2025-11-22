import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaChartLine,
  FaMoneyBillWave,
  FaShoppingCart,
  FaPercent,
  FaCircle,
  FaSync,
} from "react-icons/fa";
import api from "../shared/api";
import ReportChart from "../components/ReportChart.jsx";
import "./Reports.css";

const formatCurrency = (value) =>
  new Intl.NumberFormat("uz-UZ").format(Math.round(Number(value) || 0));

const formatPercent = (value) => `${(value * 100).toFixed(0)}%`;

const PAYMENT_LABELS = {
  cash: "Naqd",
  card: "Terminal",
  online: "Online",
  qr: "QR",
  other: "Boshqa",
};

const STATUS_LABELS = {
  new: "Yangi",
  in_progress: "Jarayonda",
  ready: "Tayyor",
  closed: "Yopilgan",
  cancelled: "Bekor qilingan",
  unknown: "Noma'lum",
};

const TYPE_LABELS = {
  table: "Zalda",
  delivery: "Dostavka",
  soboy: "Olib ketish",
};

const resolveRange = (preset) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  switch (preset) {
    case "today":
      return { from: todayStart, to: todayEnd };
    case "yesterday": {
      const from = new Date(todayStart);
      from.setDate(from.getDate() - 1);
      const to = new Date(todayEnd);
      to.setDate(to.getDate() - 1);
      return { from, to };
    }
    case "last7": {
      const from = new Date(todayStart);
      from.setDate(from.getDate() - 6);
      return { from, to: todayEnd };
    }
    case "last30": {
      const from = new Date(todayStart);
      from.setDate(from.getDate() - 29);
      return { from, to: todayEnd };
    }
    default:
      return { from: todayStart, to: todayEnd };
  }
};

const QUICK_RANGES = [
  { key: "today", label: "Bugun" },
  { key: "yesterday", label: "Kecha" },
  { key: "last7", label: "7 kun" },
  { key: "last30", label: "30 kun" },
];

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState("last7");
  const [activeRange, setActiveRange] = useState(() => resolveRange("last7"));
  const [customRange, setCustomRange] = useState({ from: "", to: "" });

  const fetchReport = useCallback(async (range) => {
    if (!range?.from || !range?.to) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/reports/sales", {
        params: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      });
      setReport(res.data);
    } catch (err) {
      setError("Hisobotni yuklab bo‘lmadi. Iltimos, keyinroq qayta urining.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(activeRange);
  }, [activeRange, fetchReport]);

  const handlePresetChange = (key) => {
    setRangeKey(key);
    setActiveRange(resolveRange(key));
  };

  const handleCustomChange = (field, value) => {
    setCustomRange((prev) => ({ ...prev, [field]: value }));
  };

  const applyCustomRange = () => {
    if (!customRange.from || !customRange.to) return;
    const from = new Date(customRange.from);
    const to = new Date(customRange.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return;
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    setRangeKey("custom");
    setActiveRange({ from, to });
  };

  const handleRefresh = useCallback(() => {
    if (rangeKey === "custom") {
      fetchReport(activeRange);
      return;
    }

    const nextRange = resolveRange(rangeKey);
    setActiveRange(nextRange);
  }, [activeRange, fetchReport, rangeKey]);

  const rangeLabel = useMemo(() => {
    if (!activeRange?.from || !activeRange?.to) return "-";
    const formatter = new Intl.DateTimeFormat("uz-UZ", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return `${formatter.format(activeRange.from)} — ${formatter.format(activeRange.to)}`;
  }, [activeRange]);

  const paymentEntries = useMemo(() => {
    if (!report?.distribution?.paymentMethods) return [];
    const methods = report.distribution.paymentMethods;
    const total = Object.values(methods).reduce((sum, value) => sum + value, 0) || 1;
    return Object.entries(methods)
      .sort((a, b) => b[1] - a[1])
      .map(([method, amount]) => ({
        method,
        label: PAYMENT_LABELS[method] || method,
        amount,
        share: amount / total,
      }));
  }, [report]);

  const statusEntries = useMemo(() => {
    if (!report?.distribution?.byStatus) return [];
    const statuses = report.distribution.byStatus;
    const total = Object.values(statuses).reduce((sum, value) => sum + value, 0) || 1;
    return Object.entries(statuses)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({
        status,
        label: STATUS_LABELS[status] || status,
        count,
        share: count / total,
      }));
  }, [report]);

  const typeEntries = useMemo(() => {
    if (!report?.distribution?.byType) return [];
    const entries = Object.entries(report.distribution.byType);
    const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
    return entries.map(([type, count]) => ({
      type,
      label: TYPE_LABELS[type] || type,
      count,
      share: count / total,
    }));
  }, [report]);

  const recentOrders = report?.recentOrders ?? [];

  return (
    <div className="page-shell reports-shell">
      <header className="page-header">
        <div>
          <p className="tagline">Intelligent Analytics</p>
          <h1 className="page-title">Hisobotlar </h1>
          <p className="page-subtitle">Faol diapazon: {rangeLabel}</p>
        </div>
        <div className="reports-actions">
          <div className="reports-quick-switch">
            {QUICK_RANGES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`reports-chip${rangeKey === key ? " active" : ""}`}
                onClick={() => handlePresetChange(key)}
                disabled={loading && rangeKey === key}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="reports-custom-range">
            <label>
              <span>Dan</span>
              <input
                type="date"
                value={customRange.from}
                onChange={(e) => handleCustomChange("from", e.target.value)}
              />
            </label>
            <label>
              <span>Gacha</span>
              <input
                type="date"
                value={customRange.to}
                onChange={(e) => handleCustomChange("to", e.target.value)}
              />
            </label>
            <button type="button" className="btn-ghost" onClick={applyCustomRange}>
              Qo‘llash
            </button>
            <button
              type="button"
              className={`btn-primary reports-refresh${loading ? " is-busy" : ""}`}
              onClick={handleRefresh}
              disabled={loading}
            >
              <FaSync className="reports-refresh-icon" />
              {loading ? "Yangilanmoqda..." : "Yangilash"}
            </button>
          </div>
        </div>
      </header>

      {error && <div className="alert alert--danger">{error}</div>}

      <section className="section-grid section-grid--cols-4 reports-summary-grid">
        <article className="glass-card reports-stat-card">
          <div className="reports-stat-icon reports-stat-icon--primary">
            <FaMoneyBillWave />
          </div>
          <div>
            <p className="reports-stat-label">Umumiy tushum</p>
            <h3 className="reports-stat-value">{formatCurrency(report?.totals?.grossSales || 0)} so‘m</h3>
            <span className="reports-stat-sub">Soliq: {formatCurrency(report?.totals?.taxCollected || 0)} so‘m</span>
          </div>
        </article>
        <article className="glass-card reports-stat-card">
          <div className="reports-stat-icon reports-stat-icon--accent">
            <FaShoppingCart />
          </div>
          <div>
            <p className="reports-stat-label">Buyurtmalar soni</p>
            <h3 className="reports-stat-value">{report?.totals?.ordersCount || 0}</h3>
            <span className="reports-stat-sub">O‘rtacha {report?.totals?.averageItemsPerOrder?.toFixed(1) || 0} pozitsiya</span>
          </div>
        </article>
        <article className="glass-card reports-stat-card">
          <div className="reports-stat-icon reports-stat-icon--alt">
            <FaPercent />
          </div>
          <div>
            <p className="reports-stat-label">Sof tushum</p>
            <h3 className="reports-stat-value">{formatCurrency(report?.totals?.netSales || 0)} so‘m</h3>
            <span className="reports-stat-sub">Chegirmalar: {formatCurrency(report?.totals?.discountGiven || 0)} so‘m</span>
          </div>
        </article>
        <article className="glass-card reports-stat-card">
          <div className="reports-stat-icon">
            <FaChartLine />
          </div>
          <div>
            <p className="reports-stat-label">O‘rtacha chek</p>
            <h3 className="reports-stat-value">{formatCurrency(report?.totals?.avgOrderValue || 0)} so‘m</h3>
            <span className="reports-stat-sub">To‘lovlar: {report?.totals?.paymentsCount || 0} ta</span>
          </div>
        </article>
      </section>

      <section className="reports-analytics-grid">
        <article className="glass-panel reports-chart-card">
          <header className="reports-card-head">
            <h3>Kunlik tushum dinamikasi</h3>
            <span>{loading ? "Yuklanmoqda..." : "So‘nggi qiymatlar"}</span>
          </header>
          <ReportChart data={report?.revenueTrend} />
        </article>

        <article className="glass-panel reports-breakdown-card">
          <header className="reports-card-head">
            <h3>To‘lov usullari</h3>
            <span>{formatCurrency(report?.totals?.netSales || 0)} so‘m</span>
          </header>
          <ul className="reports-breakdown-list">
            {paymentEntries.length === 0 && <li className="reports-empty">Ma'lumot mavjud emas</li>}
            {paymentEntries.map(({ method, label, amount, share }) => (
              <li key={method}>
                <div className="reports-breakdown-row">
                  <span className="reports-breakdown-name">{label}</span>
                  <span className="reports-breakdown-value">{formatCurrency(amount)} so‘m</span>
                </div>
                <div className="reports-progress">
                  <div className="reports-progress-fill" style={{ width: `${share * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="reports-analytics-grid">
        <article className="glass-panel reports-status-card">
          <header className="reports-card-head">
            <h3>Buyurtma statuslari</h3>
            <span>{report?.totals?.ordersCount || 0} ta</span>
          </header>
          <ul className="reports-status-list">
            {statusEntries.length === 0 && <li className="reports-empty">Ma'lumot mavjud emas</li>}
            {statusEntries.map(({ status, label, count, share }) => (
              <li key={status}>
                <div className="reports-status-row">
                  <span className="reports-status-name">
                    <FaCircle />
                    {label}
                  </span>
                  <span className="reports-status-value">{count} ({formatPercent(share)})</span>
                </div>
                <div className="reports-progress">
                  <div className="reports-progress-fill" style={{ width: `${share * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="glass-panel reports-type-card">
          <header className="reports-card-head">
            <h3>Servis kanallari</h3>
            <span>Taqqoslash</span>
          </header>
          <div className="reports-type-grid">
            {typeEntries.length === 0 && <div className="reports-empty">Ma'lumot yo‘q</div>}
            {typeEntries.map(({ type, label, count, share }) => (
              <div key={type} className="reports-type-item">
                <p className="reports-type-name">{label}</p>
                <h4 className="reports-type-value">{count}</h4>
                <span className="reports-type-share">{formatPercent(share)}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="reports-detail-grid">
        <article className="glass-panel reports-top-card">
          <header className="reports-card-head">
            <h3>Eng talabgir pozitsiyalar</h3>
            <span>Top 6</span>
          </header>
          <table className="reports-table">
            <thead>
              <tr>
                <th>Taom</th>
                <th>Soni</th>
                <th>Tushum</th>
              </tr>
            </thead>
            <tbody>
              {(!report?.topItems || report.topItems.length === 0) && (
                <tr>
                  <td colSpan={3} className="reports-empty">Ma'lumot mavjud emas</td>
                </tr>
              )}
              {report?.topItems?.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.revenue)} so‘m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="glass-panel reports-recent-card">
          <header className="reports-card-head">
            <h3>So‘nggi buyurtmalar</h3>
            <span>{recentOrders.length} ta ko‘rinmoqda</span>
          </header>
          <div className="table-scroll reports-table-scroll">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Sana</th>
                  <th>Turi</th>
                  <th>Stol / Kanal</th>
                  <th>Status</th>
                  <th>Chegirma</th>
                  <th>Summa</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="reports-empty">Hali buyurtma yo‘q</td>
                  </tr>
                )}
                {recentOrders.map((order) => (
                  <tr key={order._id}>
                    <td>{new Date(order.createdAt).toLocaleString()}</td>
                    <td>{TYPE_LABELS[order.type] || order.type}</td>
                    <td>{order.tableName || "-"}</td>
                    <td>{STATUS_LABELS[order.status] || order.status}</td>
                    <td>{formatCurrency(order.discount || 0)} so‘m</td>
                    <td>{formatCurrency(order.total || 0)} so‘m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}