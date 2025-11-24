import axios from "axios";
import React, { useEffect, useState } from "react";
import "../styles/Settings-Modern.css";

const getAgentBridge = () => (typeof window !== "undefined" ? window.posAgent || null : null);

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    general: {
      restaurantName: "ZarPOS Restoran",
      currency: "UZS",
      language: "uz",
      timezone: "Asia/Tashkent",
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h"
    },
    printer: {
      enabled: true,
      connectionType: "network",
      printerName: "Receipt Printer",
      ipAddress: "192.168.1.100",
      port: 9100,
      paperWidth: "80mm",
      printerType: "thermal",
      autoprint: false,
      printLogo: true,
      headerText: "ZarPOS Restoran",
      footerText: "Raxmat, qayta ko'ring!",
      connectionStatus: "disconnected"
    },
    payment: {
      cashEnabled: true,
      cardEnabled: true,
      mobilePaymentEnabled: false,
      allowSplitPayment: true,
      requireSignature: false,
      tipOptions: [10, 15, 20],
      defaultTipPercent: 10
    },
    tax: {
      enabled: true,
      taxName: "QQS",
      taxRate: 12,
      taxIncluded: false,
      showOnReceipt: true
    },
    discount: {
      allowDiscounts: true,
      maxDiscountPercent: 20,
      requireManagerApproval: true,
      trackDiscountReasons: true
    },
    order: {
      orderPrefix: "ORD",
      orderStartNumber: 1001,
      allowModifications: true,
      allowCancellations: true,
      requireCancellationReason: true,
      autoCompleteTime: 60
    },
    table: {
      tablePrefix: "T",
      defaultTableCapacity: 4,
      allowTableMerge: true,
      showTableStatus: true,
      tableLayout: "grid"
    },
    staff: {
      requireLogin: true,
      idleTimeout: 30,
      trackWorkHours: true,
      allowClockInOut: true,
      commissionEnabled: false,
      commissionRate: 0
    },
    security: {
      passwordMinLength: 6,
      requireStrongPassword: false,
      sessionTimeout: 60,
      allowMultipleSessions: false,
      enableAuditLog: true,
      backupFrequency: "daily"
    },
    notification: {
      orderNotifications: true,
      paymentNotifications: true,
      lowStockAlerts: false,
      emailNotifications: false,
      smsNotifications: false
    },
    kitchen: {
      kitchenDisplay: true,
      autoAssignOrders: true,
      prepTimeTracking: true,
      ingredientTracking: false,
      soundAlerts: true
    }
  });

  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);
  const [testingAgentPrint, setTestingAgentPrint] = useState(false);
  const [agentBridgeAvailable, setAgentBridgeAvailable] = useState(Boolean(getAgentBridge()));

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setAgentBridgeAvailable(Boolean(getAgentBridge()));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const resolvePrinterAgentConfig = () => {
    const dispatchModeCandidate = settings.printer?.dispatchMode || settings.printer?.dispatch_mode || "direct";
    const dispatchMode = typeof dispatchModeCandidate === "string" ? dispatchModeCandidate.toLowerCase() : "direct";
    const agentChannel =
      settings.printer?.agentChannel || settings.printer?.agent_channel || settings.printer?.restaurantId || "default";

    return { dispatchMode, agentChannel };
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/settings");
      if (res.data) {
        setSettings(res.data);
      }
    } catch (error) {
      console.error("Sozlamalarni yuklashda xato:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      await axios.put("/api/settings", settings);
      setSaveMessage("✅ Sozlamalar muvaffaqiyatli saqlandi!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      setSaveMessage("❌ Xato: " + (error.response?.data?.message || "Ma'lumotlarni saqlab bo'lmadi"));
      console.error("Sozlamalarni saqlashda xato:", error);
    } finally {
      setLoading(false);
    }
  };

  const testPrinterConnection = async () => {
    try {
      setTestingConnection(true);
      const { dispatchMode, agentChannel } = resolvePrinterAgentConfig();
      const response = await axios.post("/api/settings/test-printer-connection", {
        ipAddress: settings.printer.ipAddress,
        port: settings.printer.port,
        ...(dispatchMode === "agent"
          ? {
              dispatchMode: "agent",
              agentChannel,
            }
          : {}),
      });
      setSaveMessage(`✅ ${response.data.message}`);
      updateSettings("printer", { ...settings.printer, connectionStatus: "connected" });
    } catch (error) {
      setSaveMessage(`❌ ${error.response?.data?.message || "Printerga ulanib bo'lmadi"}`);
      updateSettings("printer", { ...settings.printer, connectionStatus: "disconnected" });
    } finally {
      setTestingConnection(false);
      setTimeout(() => setSaveMessage(""), 4000);
    }
  };

  const testPrintCheck = async () => {
    try {
      setTestingPrint(true);
      const { dispatchMode, agentChannel } = resolvePrinterAgentConfig();
      const response = await axios.post("/api/settings/test-print-check", {
        ipAddress: settings.printer.ipAddress,
        port: settings.printer.port,
        ...(dispatchMode === "agent"
          ? {
              dispatchMode: "agent",
              agentChannel,
            }
          : {}),
      });
      setSaveMessage(`✅ ${response.data.message}`);
    } catch (error) {
      setSaveMessage(`❌ ${error.response?.data?.message || "Chekni chop qilib bo'lmadi"}`);
    } finally {
      setTestingPrint(false);
      setTimeout(() => setSaveMessage(""), 4000);
    }
  };

  const testAgentPrint = async () => {
    const agent = getAgentBridge();
    const { dispatchMode, agentChannel } = resolvePrinterAgentConfig();

    try {
      setTestingAgentPrint(true);
      if (agent) {
        await agent.printTest();
        setSaveMessage("✅ Agent orqali test yuborildi");
      } else {
        const response = await axios.post("/api/settings/test-print-check", {
          ipAddress: settings.printer.ipAddress,
          port: settings.printer.port,
          dispatchMode: dispatchMode === "agent" ? "agent" : "direct",
          ...(dispatchMode === "agent" ? { agentChannel } : {}),
        });
        setSaveMessage(`✅ ${response.data?.message || "Test yuborildi"}`);
      }
    } catch (error) {
      console.error("Agent test print xatosi", error);
      setSaveMessage(`❌ ${error.response?.data?.message || error.message || "Agent test xatosi"}`);
    } finally {
      setTestingAgentPrint(false);
      setTimeout(() => setSaveMessage(""), 4000);
    }
  };

  const updateSettings = (section, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: typeof value === 'object' ? value : { ...prev[section], ...value }
    }));
  };

  const handleChange = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const tabs = [
    { id: "general", label: "Umumiy", icon: "🏪" },
    { id: "printer", label: "Printer", icon: "🖨️" },
    { id: "payment", label: "To'lov", icon: "💳" },
    { id: "tax", label: "Soliq", icon: "📊" },
    { id: "discount", label: "Chegirma", icon: "🎁" },
    { id: "order", label: "Buyurtma", icon: "📋" },
    { id: "table", label: "Stol", icon: "🪑" },
    { id: "staff", label: "Xodim", icon: "👥" },
    { id: "security", label: "Xavfsizlik", icon: "🔒" },
    { id: "notification", label: "Bildirishnoma", icon: "🔔" },
    { id: "kitchen", label: "Oshxona", icon: "👨‍🍳" }
  ];

  const renderGeneralSettings = () => (
    <div className="settings-panel">
      <h2>🏪 Umumiy Sozlamalar</h2>
      
      <div className="form-grid">
        <div className="form-group">
          <label>Restoran Nomi</label>
          <input
            type="text"
            placeholder="Restoran nomini kiriting"
            value={settings.general?.restaurantName || ""}
            onChange={(e) => handleChange("general", "restaurantName", e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Valyuta</label>
          <select
            value={settings.general?.currency || "UZS"}
            onChange={(e) => handleChange("general", "currency", e.target.value)}
          >
            <option value="UZS">🇺🇿 UZS (So'm)</option>
            <option value="USD">🇺🇸 USD (Dollar)</option>
            <option value="EUR">🇪🇺 EUR (Yevro)</option>
            <option value="RUB">🇷🇺 RUB (Rubl)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Til</label>
          <select
            value={settings.general?.language || "uz"}
            onChange={(e) => handleChange("general", "language", e.target.value)}
          >
            <option value="uz">🇺🇿 O'zbek</option>
            <option value="ru">🇷🇺 Русский</option>
            <option value="en">🇺🇸 English</option>
          </select>
        </div>

        <div className="form-group">
          <label>Vaqt Zonasi</label>
          <select
            value={settings.general?.timezone || "Asia/Tashkent"}
            onChange={(e) => handleChange("general", "timezone", e.target.value)}
          >
            <option value="Asia/Tashkent">Toshkent (UTC+5)</option>
            <option value="Asia/Samarkand">Samarqand (UTC+5)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Sana Formati</label>
          <select
            value={settings.general?.dateFormat || "DD/MM/YYYY"}
            onChange={(e) => handleChange("general", "dateFormat", e.target.value)}
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>

        <div className="form-group">
          <label>Vaqt Formati</label>
          <select
            value={settings.general?.timeFormat || "24h"}
            onChange={(e) => handleChange("general", "timeFormat", e.target.value)}
          >
            <option value="24h">24 soatlik</option>
            <option value="12h">12 soatlik (AM/PM)</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderPrinterSettings = () => (
    <div className="settings-panel">
      <h2>🖨️ Printer Sozlamalar</h2>
      
      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.printer?.enabled || false}
            onChange={(e) => handleChange("printer", "enabled", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Printerni Faollashtirish</span>
        </label>
      </div>

      {settings.printer?.enabled && (
        <>
          <div className="connection-status">
            <div className={`status-badge ${settings.printer?.connectionStatus === "connected" ? "success" : "error"}`}>
              {settings.printer?.connectionStatus === "connected" ? "✅ Ulangan" : "❌ Ulanmagan"}
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Ulanish Turi</label>
              <select
                value={settings.printer?.connectionType || "network"}
                onChange={(e) => handleChange("printer", "connectionType", e.target.value)}
              >
                <option value="network">🌐 Network (IP)</option>
                <option value="usb">🔌 USB</option>
                <option value="bluetooth">📱 Bluetooth</option>
              </select>
            </div>

            <div className="form-group">
              <label>Printer Nomi</label>
              <input
                type="text"
                placeholder="Printer nomi"
                value={settings.printer?.printerName || ""}
                onChange={(e) => handleChange("printer", "printerName", e.target.value)}
              />
            </div>

            {settings.printer?.connectionType === "network" && (
              <>
                <div className="form-group">
                  <label>IP Address</label>
                  <input
                    type="text"
                    placeholder="192.168.1.100"
                    value={settings.printer?.ipAddress || ""}
                    onChange={(e) => handleChange("printer", "ipAddress", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Port</label>
                  <input
                    type="number"
                    placeholder="9100"
                    value={settings.printer?.port || 9100}
                    onChange={(e) => handleChange("printer", "port", parseInt(e.target.value))}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label>Qog'oz Kengligi</label>
              <select
                value={settings.printer?.paperWidth || "80mm"}
                onChange={(e) => handleChange("printer", "paperWidth", e.target.value)}
              >
                <option value="58mm">58mm</option>
                <option value="80mm">80mm</option>
              </select>
            </div>

            <div className="form-group">
              <label>Printer Turi</label>
              <select
                value={settings.printer?.printerType || "thermal"}
                onChange={(e) => handleChange("printer", "printerType", e.target.value)}
              >
                <option value="thermal">Thermal</option>
                <option value="inkjet">Inkjet</option>
                <option value="laser">Laser</option>
              </select>
            </div>
          </div>

          <div className="form-group full-width">
            <label>Chek Sarlavhasi</label>
            <input
              type="text"
              placeholder="ZarPOS Restoran"
              value={settings.printer?.headerText || ""}
              onChange={(e) => handleChange("printer", "headerText", e.target.value)}
            />
          </div>

          <div className="form-group full-width">
            <label>Chek Pastki Matni</label>
            <input
              type="text"
              placeholder="Raxmat, qayta ko'ring!"
              value={settings.printer?.footerText || ""}
              onChange={(e) => handleChange("printer", "footerText", e.target.value)}
            />
          </div>

          <div className="toggle-section">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={settings.printer?.autoprint || false}
                onChange={(e) => handleChange("printer", "autoprint", e.target.checked)}
              />
              <span className="toggle-switch"></span>
              <span>Avtomatik Chop Qilish</span>
            </label>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={settings.printer?.printLogo || false}
                onChange={(e) => handleChange("printer", "printLogo", e.target.checked)}
              />
              <span className="toggle-switch"></span>
              <span>Logotipni Chop Qilish</span>
            </label>
          </div>

          <div className="button-group">
            <button 
              className="btn-test"
              onClick={testPrinterConnection}
              disabled={testingConnection}
            >
              {testingConnection ? "Tekshirilmoqda..." : "🔌 Ulanishni Tekshirish"}
            </button>
            
            <button 
              className="btn-test"
              onClick={testPrintCheck}
              disabled={testingPrint}
            >
              {testingPrint ? "Chop qilinyapti..." : "🖨️ Test Chek"}
            </button>

            <button
              className="btn-test"
              onClick={testAgentPrint}
              disabled={testingAgentPrint}
            >
              {testingAgentPrint
                ? "Agent yuboryapti..."
                : agentBridgeAvailable
                ? "🛰️ Agent sinovi"
                : "🛰️ Agent sinovi (backend)"}
            </button>
          </div>

          {!agentBridgeAvailable && (
            <p className="agent-hint">
              Lokal agent yoqilmagan bo'lsa, tugma backend orqali masofadagi agentga sinov yuboradi. Kanal nomi mos ekanligiga ishonch hosil qiling.
            </p>
          )}
        </>
      )}
    </div>
  );

  const renderPaymentSettings = () => (
    <div className="settings-panel">
      <h2>💳 To'lov Sozlamalari</h2>
      
      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.payment?.cashEnabled || false}
            onChange={(e) => handleChange("payment", "cashEnabled", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>💵 Naqd To'lov</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.payment?.cardEnabled || false}
            onChange={(e) => handleChange("payment", "cardEnabled", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>💳 Karta To'lovi</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.payment?.mobilePaymentEnabled || false}
            onChange={(e) => handleChange("payment", "mobilePaymentEnabled", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>📱 Mobil To'lov</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.payment?.allowSplitPayment || false}
            onChange={(e) => handleChange("payment", "allowSplitPayment", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Bo'lib To'lash</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.payment?.requireSignature || false}
            onChange={(e) => handleChange("payment", "requireSignature", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Imzo Talab Qilish</span>
        </label>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Standart Tip (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={settings.payment?.defaultTipPercent || 10}
            onChange={(e) => handleChange("payment", "defaultTipPercent", parseInt(e.target.value))}
          />
        </div>
      </div>
    </div>
  );

  const renderTaxSettings = () => (
    <div className="settings-panel">
      <h2>📊 Soliq Sozlamalari</h2>
      
      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.tax?.enabled || false}
            onChange={(e) => handleChange("tax", "enabled", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Soliqni Faollashtirish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.tax?.taxIncluded || false}
            onChange={(e) => handleChange("tax", "taxIncluded", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Narxga Kiritilgan</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.tax?.showOnReceipt || false}
            onChange={(e) => handleChange("tax", "showOnReceipt", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Chekda Ko'rsatish</span>
        </label>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Soliq Nomi</label>
          <input
            type="text"
            placeholder="QQS"
            value={settings.tax?.taxName || ""}
            onChange={(e) => handleChange("tax", "taxName", e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Soliq Stavkasi (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={settings.tax?.taxRate || 12}
            onChange={(e) => handleChange("tax", "taxRate", parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );

  const renderDiscountSettings = () => (
    <div className="settings-panel">
      <h2>🎁 Chegirma Sozlamalari</h2>
      
      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.discount?.allowDiscounts || false}
            onChange={(e) => handleChange("discount", "allowDiscounts", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Chegirmalarni Ruxsat Berish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.discount?.requireManagerApproval || false}
            onChange={(e) => handleChange("discount", "requireManagerApproval", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Menejer Tasdig'i Kerak</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.discount?.trackDiscountReasons || false}
            onChange={(e) => handleChange("discount", "trackDiscountReasons", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Sabab Kuzatish</span>
        </label>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Maksimal Chegirma (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={settings.discount?.maxDiscountPercent || 20}
            onChange={(e) => handleChange("discount", "maxDiscountPercent", parseInt(e.target.value))}
          />
        </div>
      </div>
    </div>
  );

  const renderOrderSettings = () => (
    <div className="settings-panel">
      <h2>📋 Buyurtma Sozlamalari</h2>
      
      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.order?.allowModifications || false}
            onChange={(e) => handleChange("order", "allowModifications", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>O'zgartirishga Ruxsat</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.order?.allowCancellations || false}
            onChange={(e) => handleChange("order", "allowCancellations", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Bekor Qilishga Ruxsat</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.order?.requireCancellationReason || false}
            onChange={(e) => handleChange("order", "requireCancellationReason", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Bekor Qilish Sababi Kerak</span>
        </label>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Buyurtma Prefiksi</label>
          <input
            type="text"
            placeholder="ORD"
            value={settings.order?.orderPrefix || ""}
            onChange={(e) => handleChange("order", "orderPrefix", e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Boshlang'ich Raqam</label>
          <input
            type="number"
            min="1"
            value={settings.order?.orderStartNumber || 1001}
            onChange={(e) => handleChange("order", "orderStartNumber", parseInt(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Avtomatik Tugatish (daqiqa)</label>
          <input
            type="number"
            min="0"
            value={settings.order?.autoCompleteTime || 60}
            onChange={(e) => handleChange("order", "autoCompleteTime", parseInt(e.target.value))}
          />
        </div>
      </div>
    </div>
  );

  const renderTableSettings = () => (
    <div className="settings-panel">
      <h2>🪑 Stol Sozlamalari</h2>
      
      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.table?.allowTableMerge || false}
            onChange={(e) => handleChange("table", "allowTableMerge", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Stollarni Birlashtirish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.table?.showTableStatus || false}
            onChange={(e) => handleChange("table", "showTableStatus", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Stol Holatini Ko'rsatish</span>
        </label>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Stol Prefiksi</label>
          <input
            type="text"
            placeholder="T"
            value={settings.table?.tablePrefix || ""}
            onChange={(e) => handleChange("table", "tablePrefix", e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Standart Sig'im</label>
          <input
            type="number"
            min="1"
            value={settings.table?.defaultTableCapacity || 4}
            onChange={(e) => handleChange("table", "defaultTableCapacity", parseInt(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Stol Joylashuvi</label>
          <select
            value={settings.table?.tableLayout || "grid"}
            onChange={(e) => handleChange("table", "tableLayout", e.target.value)}
          >
            <option value="grid">Grid</option>
            <option value="list">List</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStaffSettings = () => (
    <div className="settings-panel">
      <h2>👥 Xodim Sozlamalari</h2>
      
      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.staff?.requireLogin || false}
            onChange={(e) => handleChange("staff", "requireLogin", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Login Talab Qilish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.staff?.trackWorkHours || false}
            onChange={(e) => handleChange("staff", "trackWorkHours", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Ish Soatlarini Kuzatish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.staff?.allowClockInOut || false}
            onChange={(e) => handleChange("staff", "allowClockInOut", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Kelish/Ketishni Belgilash</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.staff?.commissionEnabled || false}
            onChange={(e) => handleChange("staff", "commissionEnabled", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Komissiya Faollashtirish</span>
        </label>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Idle Timeout (daqiqa)</label>
          <input
            type="number"
            min="0"
            value={settings.staff?.idleTimeout || 30}
            onChange={(e) => handleChange("staff", "idleTimeout", parseInt(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Komissiya Stavkasi (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={settings.staff?.commissionRate || 0}
            onChange={(e) => handleChange("staff", "commissionRate", parseFloat(e.target.value))}
            disabled={!settings.staff?.commissionEnabled}
          />
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="settings-panel">
      <h2>🔒 Xavfsizlik Sozlamalari</h2>
      
      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.security?.requireStrongPassword || false}
            onChange={(e) => handleChange("security", "requireStrongPassword", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Kuchli Parol Talab Qilish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.security?.allowMultipleSessions || false}
            onChange={(e) => handleChange("security", "allowMultipleSessions", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Ko'p Sessiya Ruxsat Berish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.security?.enableAuditLog || false}
            onChange={(e) => handleChange("security", "enableAuditLog", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Audit Logini Faollashtirish</span>
        </label>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Minimal Parol Uzunligi</label>
          <input
            type="number"
            min="4"
            max="20"
            value={settings.security?.passwordMinLength || 6}
            onChange={(e) => handleChange("security", "passwordMinLength", parseInt(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Sessiya Timeout (daqiqa)</label>
          <input
            type="number"
            min="0"
            value={settings.security?.sessionTimeout || 60}
            onChange={(e) => handleChange("security", "sessionTimeout", parseInt(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Backup Chastotasi</label>
          <select
            value={settings.security?.backupFrequency || "daily"}
            onChange={(e) => handleChange("security", "backupFrequency", e.target.value)}
          >
            <option value="hourly">Har soat</option>
            <option value="daily">Har kun</option>
            <option value="weekly">Har hafta</option>
            <option value="monthly">Har oy</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="settings-panel">
      <h2>🔔 Bildirishnoma Sozlamalari</h2>
      
      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.notification?.orderNotifications || false}
            onChange={(e) => handleChange("notification", "orderNotifications", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Buyurtma Bildirish nomalari</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.notification?.paymentNotifications || false}
            onChange={(e) => handleChange("notification", "paymentNotifications", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>To'lov Bildirish nomalari</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.notification?.lowStockAlerts || false}
            onChange={(e) => handleChange("notification", "lowStockAlerts", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Kam Qolgan Mahsulot Ogohlantirish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.notification?.emailNotifications || false}
            onChange={(e) => handleChange("notification", "emailNotifications", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>📧 Email Bildirishnoma</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.notification?.smsNotifications || false}
            onChange={(e) => handleChange("notification", "smsNotifications", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>📱 SMS Bildirishnoma</span>
        </label>
      </div>
    </div>
  );

  const renderKitchenSettings = () => (
    <div className="settings-panel">
      <h2>👨‍🍳 Oshxona Sozlamalari</h2>
      
      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.kitchen?.kitchenDisplay || false}
            onChange={(e) => handleChange("kitchen", "kitchenDisplay", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Oshxona Displeyini Faollashtirish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.kitchen?.autoAssignOrders || false}
            onChange={(e) => handleChange("kitchen", "autoAssignOrders", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Avtomatik Buyurtma Belgilash</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.kitchen?.prepTimeTracking || false}
            onChange={(e) => handleChange("kitchen", "prepTimeTracking", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Tayyorlanish Vaqtini Kuzatish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.kitchen?.ingredientTracking || false}
            onChange={(e) => handleChange("kitchen", "ingredientTracking", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Ingrediyent Kuzatish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.kitchen?.soundAlerts || false}
            onChange={(e) => handleChange("kitchen", "soundAlerts", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>🔊 Ovozli Ogohlantirish</span>
        </label>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "general":
        return renderGeneralSettings();
      case "printer":
        return renderPrinterSettings();
      case "payment":
        return renderPaymentSettings();
      case "tax":
        return renderTaxSettings();
      case "discount":
        return renderDiscountSettings();
      case "order":
        return renderOrderSettings();
      case "table":
        return renderTableSettings();
      case "staff":
        return renderStaffSettings();
      case "security":
        return renderSecuritySettings();
      case "notification":
        return renderNotificationSettings();
      case "kitchen":
        return renderKitchenSettings();
      default:
        return renderGeneralSettings();
    }
  };

  if (loading && !settings.general) {
    return (
      <div className="settings-page">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Yuklanyapti...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>⚙️ Tizim Sozlamalari</h1>
        {saveMessage && (
          <div className={`save-message ${saveMessage.includes("✅") ? "success" : "error"}`}>
            {saveMessage}
          </div>
        )}
      </div>

      <div className="settings-layout">
        <div className="settings-sidebar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`sidebar-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="settings-content">
          {renderContent()}
        </div>
      </div>

      <div className="settings-footer">
        <button 
          className="btn-save" 
          onClick={saveSettings}
          disabled={loading}
        >
          {loading ? "Saqlanmoqda..." : "💾 Sozlamalarni Saqlash"}
        </button>
      </div>
    </div>
  );
}
