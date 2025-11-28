import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FiDownload, FiPrinter } from "react-icons/fi";
import api from "../shared/api";
import { printCheck, downloadCheckAsHTML } from "../utils/checkPrinter";
import "./PaymentPanel.css";

const paymentTypes = [
  { key: "cash", label: "Naqd" },
  { key: "card", label: "Karta" },
  { key: "qr", label: "QR" },
  { key: "mixed", label: "Aralash" },
  { key: "split", label: "Bo'lib to'lash" },
];

const DISCOUNT_PRESETS = [0, 5, 10, 15];

const PaymentPanel = ({ order, onPaid }) => {
  const [method, setMethod] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCheckOptions, setShowCheckOptions] = useState(false);
  const [printerSettings, setPrinterSettings] = useState({});
  const [printing, setPrinting] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("uz-UZ"), []);
  const formatCurrency = useCallback(
    (value) => `${numberFormatter.format(Math.max(0, Math.round(value || 0)))} so'm`,
    [numberFormatter]
  );

  const orderItems = useMemo(() => {
    if (!Array.isArray(order?.items)) return [];
    return order.items.map((item, index) => {
      const qty = Number(item?.qty ?? 0) || 0;
      const price = Number(item?.price ?? 0) || 0;
      const total = qty * price;
      const modifiers = Array.isArray(item?.modifiers) ? item.modifiers : [];
      return {
        key: item?._id || `${index}-${item?.name || "item"}`,
        name: item?.name || "Pozitsiya",
        qty,
        price,
        total,
        notes: item?.notes || "",
        modifiers: modifiers
          .filter(Boolean)
          .map((mod) => (typeof mod === "string" ? mod : mod?.name))
          .filter(Boolean),
      };
    });
  }, [order?.items]);

  const totals = useMemo(() => {
    const items = orderItems;
    const subtotal =
      typeof order?.subtotal === "number"
        ? order.subtotal
        : items.reduce((acc, item) => acc + (item.price || 0) * (item.qty || 1), 0);
    const tax = typeof order?.tax === "number" ? order.tax : 0;
    const totalBeforeDiscount = subtotal + tax;
    const baseDiscount =
      typeof order?.discount === "number"
        ? Math.min(order.discount, totalBeforeDiscount)
        : 0;
    const totalDue = Math.max(0, totalBeforeDiscount - baseDiscount);
    const itemCount = items.reduce((acc, item) => acc + (item.qty || 0), 0);

    return {
      subtotal,
      tax,
      totalBeforeDiscount,
      baseDiscount,
      totalDue,
      itemCount,
    };
  }, [order, orderItems]);

  const maxDiscount = totals.totalBeforeDiscount;

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get("/settings");
        if (res.data?.printerSettings) {
          setPrinterSettings(res.data.printerSettings);
        }
      } catch (err) {
        console.error("Printer sozlamalarini yuklashda xato:", err);
      }
    };

    fetchSettings();
  }, []);

  useEffect(() => {
    setMethod("cash");
    setDiscount(totals.baseDiscount);
    setAmount(totals.totalDue);
    setError("");
    setSuccess("");
    setShowCheckOptions(false);
    setLastPayment(null);
  }, [order?._id, totals.baseDiscount, totals.totalDue]);

  const clampCurrency = useCallback(
    (value) => {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return 0;
      }
      return Math.max(0, Math.round(value));
    },
    []
  );

  const handleDiscountChange = useCallback(
    (value) => {
      const sanitized = clampCurrency(value);
      const clamped = Math.min(sanitized, clampCurrency(maxDiscount));
      setDiscount(clamped);
      setAmount(Math.max(0, clampCurrency(maxDiscount) - clamped));
    },
    [clampCurrency, maxDiscount]
  );

  const handleDiscountPreset = useCallback(
    (percent) => {
      if (!maxDiscount) {
        handleDiscountChange(0);
        return;
      }
      const value = (maxDiscount * percent) / 100;
      handleDiscountChange(value);
    },
    [handleDiscountChange, maxDiscount]
  );

  const handleAmountChange = useCallback(
    (value) => {
      const sanitized = clampCurrency(value);
      const clamped = Math.min(sanitized, clampCurrency(maxDiscount));
      setAmount(clamped);
      setDiscount(Math.max(0, clampCurrency(maxDiscount) - clamped));
    },
    [clampCurrency, maxDiscount]
  );

  const buildCheckPayload = useCallback(
    (paymentMeta = {}) => ({
      ...order,
      tableName: order?.table?.name || order?.tableName || "Dostavka",
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount,
      total: amount,
      payment: {
        method,
        amount,
        ...paymentMeta,
      },
    }),
    [amount, discount, method, order, totals.subtotal, totals.tax]
  );

  const handlePay = async () => {
    if (!order?._id) {
      setError("Buyurtma tanlanmagan");
      return;
    }

    const normalizedDiscount = clampCurrency(discount);
    const normalizedAmount = clampCurrency(amount);

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (
        normalizedDiscount !== clampCurrency(order?.discount) ||
        normalizedAmount !== clampCurrency(order?.total ?? totals.totalDue)
      ) {
        await api.put(`/orders/${order._id}`, {
          discount: normalizedDiscount,
          total: normalizedAmount,
        });
      }

      const paymentResponse = await api.post("/payments", {
        orderId: order._id,
        amount: normalizedAmount,
        method,
      });

      const paymentData = paymentResponse.data;
      setLastPayment(paymentData);
      setShowCheckOptions(true);

      const summary = paymentData?.printReport?.summary;
      let successMessage = "To'lov muvaffaqiyatli bajarildi!";
      if (summary) {
        if (!summary.total) {
          successMessage = "To'lov muvaffaqiyatli. Printerga yuborilmagan.";
        } else if (summary.failed) {
          successMessage = `To'lov bajarildi, lekin ${summary.failed} printer xatolik qaytardi.`;
        } else {
          successMessage = "To'lov bajarildi va chek printerga yuborildi.";
        }
      }
      setSuccess(successMessage);
      if (summary) {
        if (!summary.total) {
          setError("Printerga yuborilmadi. Printer sozlamalarini tekshiring.");
        } else if (!summary.success && summary.failed) {
          setError(`${summary.failed} ta printer xatolik qaytardi.`);
        }
      }

      if (onPaid) {
        setTimeout(() => onPaid(), 1400);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "To'lovda xatolik");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintCheck = async () => {
    const payload = buildCheckPayload(lastPayment || {});

    if (!lastPayment?._id) {
      printCheck(payload, payload.payment, printerSettings);
      return;
    }

    setPrinting(true);
    setError("");

    try {
      const response = await api.post(`/payments/${lastPayment._id}/print`, {
        printerId: printerSettings?.defaultPrinterId || null,
        dispatchMode: printerSettings?.dispatchMode,
        agentChannel: printerSettings?.agentChannel,
      });

      const { success: printSuccess, message, printReport: report } = response.data || {};
      const summary = report?.summary;

      setLastPayment((prev) => (prev ? { ...prev, printReport: report } : prev));

      if (printSuccess) {
        setSuccess(message || "Chek printerga yuborildi");
        if (summary?.failed) {
          setError(`${summary.failed} ta printer xatolik qaytardi.`);
        } else {
          setError("");
        }
      } else {
        setSuccess("");
        if (summary?.failed) {
          setError(`${summary.failed} ta printer xatolik qaytardi.`);
        } else if (!summary?.total) {
          setError(message || "Faol printer topilmadi");
        } else {
          setError(message || "Chekni chop qilib bo'lmadi");
        }
      }
    } catch (err) {
      setSuccess("");
      setError(err?.response?.data?.message || "Chekni chop qilib bo'lmadi");
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadCheck = () => {
    const payload = buildCheckPayload(lastPayment || {});
    downloadCheckAsHTML(payload, payload.payment, printerSettings);
  };

  const activeDiscountPercent = maxDiscount
    ? Math.round((discount / maxDiscount) * 100)
    : 0;

  return (
    <section className="payment-panel">
      <header className="payment-panel-head">
        <div className="payment-panel-title">
          <span className="payment-panel-tag">Kassa to'lovi</span>
          <h3>Chekni yopish</h3>
          <p>
            {order?.table?.name || order?.tableName || "Stol tanlanmagan"}
            {totals.itemCount ? ` • ${totals.itemCount} ta pozitsiya` : ""}
          </p>
        </div>
        <div className="payment-total-badge">
          <span>Umumiy</span>
          <strong>{formatCurrency(amount)}</strong>
        </div>
      </header>

      <div className="payment-summary-grid">
        <div className="payment-summary-card">
          <span>Jami</span>
          <strong>{formatCurrency(totals.subtotal)}</strong>
        </div>
        <div className="payment-summary-card">
          <span>Servis</span>
          <strong>{formatCurrency(totals.tax)}</strong>
        </div>
        <div className="payment-summary-card">
          <span>Chegirma</span>
          <strong>-{formatCurrency(discount)}</strong>
        </div>
        <div className="payment-summary-card highlighted">
          <span>To'lov</span>
          <strong>{formatCurrency(amount)}</strong>
        </div>
      </div>

      {order?._id && (
        <div className="payment-items-card">
          <div className="payment-items-head">
            <div>
              <span className="payment-section-label">Buyurtma pozitsiyalari</span>
              <p>
                {orderItems.length > 0
                  ? `${orderItems.length} ta nom, ${totals.itemCount} dona`
                  : "Pozitsiyalar hali qo'shilmagan"}
              </p>
            </div>
            <span className="payment-items-total">{formatCurrency(totals.subtotal)}</span>
          </div>
          {orderItems.length > 0 ? (
            <div className="payment-items-scroll">
              <table className="payment-items-table">
                <thead>
                  <tr>
                    <th>Taom</th>
                    <th className="align-center">Soni</th>
                    <th className="align-right">Narx</th>
                    <th className="align-right">Jami</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item) => (
                    <React.Fragment key={item.key}>
                      <tr>
                        <td>
                          <strong className="payment-item-name">{item.name}</strong>
                          {item.modifiers.length > 0 && (
                            <span className="payment-item-meta">{item.modifiers.join(", ")}</span>
                          )}
                        </td>
                        <td className="align-center">{item.qty}</td>
                        <td className="align-right">{formatCurrency(item.price)}</td>
                        <td className="align-right">{formatCurrency(item.total)}</td>
                      </tr>
                      {item.notes && (
                        <tr className="payment-item-notes-row">
                          <td colSpan={4} className="payment-item-notes">
                            {item.notes}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="payment-items-empty">Bu buyurtmada pozitsiyalar mavjud emas.</div>
          )}
        </div>
      )}

      <div className="payment-method-section">
        <span className="payment-section-label">To'lov turi</span>
        <div className="payment-methods">
          {paymentTypes.map((pt) => (
            <button
              key={pt.key}
              className={`payment-chip${method === pt.key ? " selected" : ""}`}
              type="button"
              onClick={() => setMethod(pt.key)}
              disabled={loading}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="payment-input-grid">
        <div className="payment-input-block">
          <label htmlFor="discount-input">Chegirma</label>
          <div className="payment-input">
            <input
              id="discount-input"
              type="number"
              inputMode="numeric"
              min={0}
              max={Math.max(0, Math.round(maxDiscount))}
              step={1000}
              value={discount}
              onChange={(event) => handleDiscountChange(Number(event.target.value))}
              disabled={loading || !maxDiscount}
            />
            <span className="payment-input-suffix">so'm</span>
          </div>
          <div className="payment-quick-row">
            {DISCOUNT_PRESETS.map((preset) => {
              const presetValue = Math.round((maxDiscount * preset) / 100) || 0;
              const isActive =
                maxDiscount > 0
                  ? Math.abs(activeDiscountPercent - preset) < 2
                  : preset === 0;
              return (
                <button
                  key={preset}
                  type="button"
                  className={`payment-quick-btn${isActive ? " active" : ""}`}
                  onClick={() => handleDiscountPreset(preset)}
                  disabled={loading || !maxDiscount}
                >
                  {preset === 0 ? "0%" : `${preset}%`}
                  {presetValue > 0 && maxDiscount > 0 ? ` (${numberFormatter.format(presetValue)})` : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="payment-input-block">
          <label htmlFor="amount-input">Yopiladigan summa</label>
          <div className="payment-input prominent">
            <input
              id="amount-input"
              type="number"
              inputMode="numeric"
              min={0}
              max={Math.max(0, Math.round(maxDiscount))}
              step={1000}
              value={amount}
              onChange={(event) => handleAmountChange(Number(event.target.value))}
              disabled={loading}
            />
            <span className="payment-input-suffix">so'm</span>
          </div>
          <p className="payment-input-helper">
            Chegirma summadan avtomatik tarzda ayiriladi.
          </p>
        </div>
      </div>

      {error && <div className="payment-alert error">{error}</div>}
      {success && <div className="payment-alert success">{success}</div>}

      <button
        type="button"
        className="payment-confirm-btn"
        onClick={handlePay}
        disabled={loading || !order?._id}
      >
        {loading ? "Yuborilmoqda..." : "To'lovni yakunlash"}
      </button>

      {showCheckOptions && (
        <div className="payment-check-actions">
          <span>Chek amallari</span>
          <div className="payment-check-buttons">
            <button
              type="button"
              className="payment-check-btn"
              onClick={handlePrintCheck}
              disabled={printing}
            >
              <FiPrinter /> {printing ? "Chek yuborilmoqda..." : "Chekni chop etish"}
            </button>
            <button type="button" className="payment-check-btn secondary" onClick={handleDownloadCheck}>
              <FiDownload /> Chekni yuklab olish
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default PaymentPanel;
