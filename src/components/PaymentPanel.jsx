import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FiDownload, FiMinusCircle, FiPrinter, FiTrash2 } from "react-icons/fi";
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

const PaymentPanel = ({ order, onPaid, onOrderUpdate = () => {} }) => {
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
  const [editableItems, setEditableItems] = useState([]);
  const [originalItems, setOriginalItems] = useState([]);
  const [itemsSaving, setItemsSaving] = useState(false);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("uz-UZ"), []);
  const formatCurrency = useCallback(
    (value) => `${numberFormatter.format(Math.max(0, Math.round(value || 0)))} so'm`,
    [numberFormatter]
  );

  const normalizeOrderItems = useCallback((items) => {
    if (!Array.isArray(items)) return [];
    return items.map((item, index) => {
      const source = item ? JSON.parse(JSON.stringify(item)) : {};
      const key = source?._id ? String(source._id) : `${index}-${source?.menuItem || "manual"}`;
      const qty = Number(source?.qty ?? 0) || 0;
      const price = Number(source?.price ?? 0) || 0;
      const modifiers = Array.isArray(source?.modifiers)
        ? source.modifiers
            .map((modifier) => {
              if (!modifier) return null;
              if (typeof modifier === "string") {
                return { name: modifier, price: 0 };
              }
              return {
                name: modifier?.name || "",
                price: Number(modifier?.price || 0),
              };
            })
            .filter(Boolean)
        : [];

      return {
        ...source,
        __key: key,
        qty,
        price,
        notes: typeof source?.notes === "string" ? source.notes : "",
        portionKey: source?.portionKey || "standard",
        portionLabel: source?.portionLabel || "",
        pricingMode: source?.pricingMode || "fixed",
        weightUnit: source?.weightUnit || "",
        displayQty: source?.displayQty || "",
        modifiers,
        productionPrinterIds: Array.isArray(source?.productionPrinterIds)
          ? source.productionPrinterIds.filter(Boolean)
          : [],
        productionTags: Array.isArray(source?.productionTags)
          ? source.productionTags.filter(Boolean)
          : [],
      };
    });
  }, []);

  const serializeItems = useCallback((items) => {
    return JSON.stringify(
      (Array.isArray(items) ? items : []).map(({ __key, ...rest }) => ({
        ...rest,
        modifiers: Array.isArray(rest.modifiers)
          ? rest.modifiers.map((modifier) => ({
              name: modifier?.name || "",
              price: Number(modifier?.price || 0),
            }))
          : [],
      }))
    );
  }, []);

  useEffect(() => {
    const normalized = normalizeOrderItems(order?.items || []);
    setEditableItems(normalized);
    setOriginalItems(normalized);
  }, [normalizeOrderItems, order?.items, order?._id]);

  const orderItems = useMemo(() => {
    if (!Array.isArray(editableItems)) return [];
    return editableItems
      .filter((item) => Number(item?.qty ?? 0) > 0)
      .map((item, index) => {
        const key = item?.__key || item?._id || `${index}-${item?.name || "item"}`;
        const qty = Number(item?.qty ?? 0) || 0;
        const price = Number(item?.price ?? 0) || 0;
        const total = qty * price;
        const modifiers = Array.isArray(item?.modifiers) ? item.modifiers : [];
        return {
          key,
          internalKey: key,
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
  }, [editableItems]);

  const totals = useMemo(() => {
    const items = Array.isArray(editableItems)
      ? editableItems.filter((item) => Number(item?.qty ?? 0) > 0)
      : [];
    const subtotal = items.reduce(
      (acc, item) => acc + (Number(item?.price ?? 0) * Number(item?.qty ?? 0)),
      0
    );
    const tax = typeof order?.tax === "number" ? Number(order.tax) : 0;
    const totalBeforeDiscount = subtotal + tax;
    const baseDiscount = typeof order?.discount === "number"
      ? Math.min(Number(order.discount), totalBeforeDiscount)
      : 0;
    const totalDue = Math.max(0, totalBeforeDiscount - baseDiscount);
    const itemCount = items.reduce((acc, item) => acc + Number(item?.qty ?? 0), 0);

    return {
      subtotal,
      tax,
      totalBeforeDiscount,
      baseDiscount,
      totalDue,
      itemCount,
    };
  }, [editableItems, order?.discount, order?.tax]);

  const maxDiscount = totals.totalBeforeDiscount;
  const serializedOriginalItems = useMemo(
    () => serializeItems(originalItems),
    [originalItems, serializeItems]
  );
  const serializedEditableItems = useMemo(
    () => serializeItems(editableItems),
    [editableItems, serializeItems]
  );
  const itemsDirty = serializedOriginalItems !== serializedEditableItems;

  const clampCurrency = useCallback(
    (value) => {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return 0;
      }
      return Math.max(0, Math.round(value));
    },
    []
  );

  const refundSummary = useMemo(() => {
    if (!originalItems.length) {
      return { items: [], totalAmount: 0, totalQty: 0 };
    }

    const originalMap = new Map(
      originalItems.map((item) => [item.__key || item._id, item])
    );
    const currentMap = new Map(
      editableItems.map((item) => [item.__key || item._id, item])
    );

    const changes = [];

    originalMap.forEach((originalItem, key) => {
      const originalQty = Number(originalItem?.qty ?? 0);
      if (originalQty <= 0) return;
      const currentItem = currentMap.get(key);
      const currentQty = Number(currentItem?.qty ?? 0);
      const diffQty = originalQty - currentQty;
      if (diffQty > 0) {
        const unitPrice = Number(originalItem?.price ?? 0);
        changes.push({
          key,
          name: originalItem?.name || "Pozitsiya",
          qty: diffQty,
          amount: diffQty * unitPrice,
        });
      }
    });

    const totalAmount = changes.reduce((acc, change) => acc + change.amount, 0);
    const totalQty = changes.reduce((acc, change) => acc + change.qty, 0);

    return { items: changes, totalAmount, totalQty };
  }, [editableItems, originalItems]);

  useEffect(() => {
    const max = clampCurrency(maxDiscount);
    const normalizedDiscount = clampCurrency(discount);
    const clampedDiscount = Math.min(normalizedDiscount, max);
    if (clampedDiscount !== discount) {
      setDiscount(clampedDiscount);
    }
    const due = Math.max(0, max - clampedDiscount);
    setAmount((prev) => {
      const normalizedPrev = clampCurrency(prev);
      if (normalizedPrev > due) {
        return due;
      }
      return normalizedPrev;
    });
  }, [clampCurrency, discount, maxDiscount]);

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

  const handleDecreaseItem = useCallback((itemKey) => {
    setEditableItems((prev) =>
      prev.map((item) => {
        if ((item.__key || item._id) !== itemKey) return item;
        const currentQty = Number(item.qty || 0);
        if (currentQty <= 0) return { ...item, qty: 0 };
        return { ...item, qty: Math.max(0, currentQty - 1) };
      })
    );
  }, []);

  const handleRemoveItem = useCallback((itemKey) => {
    setEditableItems((prev) => prev.filter((item) => (item.__key || item._id) !== itemKey));
  }, []);

  const handleResetItems = useCallback(() => {
    setEditableItems(originalItems.map((item) => ({ ...item })));
    setError("");
    setSuccess("");
  }, [originalItems]);

  const buildPayloadItems = useCallback((items) => {
    return items
      .filter((item) => Number(item.qty || 0) > 0)
      .map((item) => ({
        menuItem: item.menuItem || null,
        name: item.name,
        qty: Number(item.qty || 0),
        price: Number(item.price || 0),
        notes: item.notes || "",
        portionKey: item.portionKey || "standard",
        portionLabel: item.portionLabel || "",
        pricingMode: item.pricingMode || "fixed",
        weightUnit: item.weightUnit || "",
        displayQty: item.displayQty || "",
        modifiers: Array.isArray(item.modifiers)
          ? item.modifiers.map((mod) => ({
              name: mod?.name || "",
              price: Number(mod?.price || 0),
            }))
          : [],
        productionPrinterIds: Array.isArray(item.productionPrinterIds)
          ? item.productionPrinterIds
          : [],
        productionTags: Array.isArray(item.productionTags)
          ? item.productionTags
          : [],
      }));
  }, []);

  const handleApplyRefund = useCallback(async () => {
    if (!order?._id) return;
    if (!refundSummary.items.length) {
      setError("Vozvrat uchun o'zgarish yo'q");
      return;
    }
    const payloadItems = buildPayloadItems(editableItems);
    setItemsSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        items: payloadItems,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.baseDiscount,
        total: totals.totalDue,
      };

      const response = await api.put(`/orders/${order._id}`, payload);
      const updatedOrder = response.data;
      const normalized = normalizeOrderItems(updatedOrder?.items || payloadItems);
      setEditableItems(normalized);
      setOriginalItems(normalized);
      if (onOrderUpdate) {
        onOrderUpdate(updatedOrder);
      }
      setSuccess("Vozvrat saqlandi");
    } catch (err) {
      setError(err?.response?.data?.message || "Vozvratni saqlab bo'lmadi");
    } finally {
      setItemsSaving(false);
    }
  }, [buildPayloadItems, editableItems, normalizeOrderItems, onOrderUpdate, order?._id, refundSummary, totals.baseDiscount, totals.subtotal, totals.tax, totals.totalDue]);

  useEffect(() => {
    setMethod("cash");
    setDiscount(totals.baseDiscount);
    setAmount(totals.totalDue);
    setError("");
    setSuccess("");
    setShowCheckOptions(false);
    setLastPayment(null);
  }, [order?._id, totals.baseDiscount, totals.totalDue]);

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
        <>
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
            <p className="payment-refund-hint">
              Vozvrat uchun minus yoki o'chirish tugmalaridan foydalaning.
            </p>
            {orderItems.length > 0 ? (
              <div className="payment-items-scroll">
                <table className="payment-items-table">
                  <thead>
                    <tr>
                      <th>Taom</th>
                      <th className="align-center">Soni</th>
                      <th className="align-right">Narx</th>
                      <th className="align-right">Jami</th>
                      <th className="align-right refund-col">Vozvrat</th>
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
                          <td className="payment-item-actions">
                            <button
                              type="button"
                              className="payment-item-action"
                              onClick={() => handleDecreaseItem(item.internalKey)}
                              disabled={loading || itemsSaving}
                              title="Soni kamaytirish"
                            >
                              <FiMinusCircle />
                            </button>
                            <button
                              type="button"
                              className="payment-item-action danger"
                              onClick={() => handleRemoveItem(item.internalKey)}
                              disabled={loading || itemsSaving}
                              title="Taomni olib tashlash"
                            >
                              <FiTrash2 />
                            </button>
                          </td>
                        </tr>
                        {item.notes && (
                          <tr className="payment-item-notes-row">
                            <td colSpan={5} className="payment-item-notes">
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

          {itemsDirty && (
            <div className="payment-refund-card">
              <div className="payment-refund-head">
                <span className="payment-section-label">Vozvrat</span>
                <span className="payment-refund-amount">{formatCurrency(refundSummary.totalAmount)}</span>
              </div>
              {refundSummary.items.length ? (
                <ul className="payment-refund-list">
                  {refundSummary.items.map((item) => (
                    <li key={item.key}>
                      <span>
                        <strong>{item.name}</strong>
                        <span className="payment-refund-qty">−{item.qty} dona</span>
                      </span>
                      <span>{formatCurrency(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="payment-refund-empty">
                  O'zgartirishlar kiritildi, ammo qaytariladigan taom aniqlanmadi.
                </div>
              )}
              <div className="payment-refund-actions">
                <button
                  type="button"
                  className="payment-refund-btn primary"
                  onClick={handleApplyRefund}
                  disabled={itemsSaving || loading}
                >
                  {itemsSaving ? "Saqlanmoqda..." : "Vozvratni tasdiqlash"}
                </button>
                <button
                  type="button"
                  className="payment-refund-btn"
                  onClick={handleResetItems}
                  disabled={itemsSaving || loading}
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          )}
        </>
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
