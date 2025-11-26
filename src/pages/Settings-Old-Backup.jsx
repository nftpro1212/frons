import axios from "axios";
import React, { useEffect, useState } from "react";
import "../styles/Settings.css";

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
    const printer = settings.printer || {};
    const dispatchModeCandidate = printer.dispatchMode || printer.dispatch_mode || "direct";
    const dispatchMode = typeof dispatchModeCandidate === "string" ? dispatchModeCandidate.toLowerCase() : "direct";
    const agentChannel = printer.agentChannel || printer.agent_channel || printer.restaurantId || "default";

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

  if (loading && !settings.general) {
    return (
      <div className="settings-container">
        <div className="loading-spinner">Yuklanyapti...</div>
      </div>
    );
  }

  const tabs = [
    { id: "general", label: "🏪 Umumiy", icon: "🏪" },
    { id: "printer", label: "🖨️ Printer", icon: "🖨️" },
    { id: "payment", label: "💳 To'lov", icon: "💳" },
    { id: "tax", label: "📊 Servis", icon: "📊" },
    { id: "discount", label: "🎁 Chegirma", icon: "🎁" },
    { id: "order", label: "📋 Buyurtma", icon: "📋" },
    { id: "table", label: "🪑 Stol", icon: "🪑" },
    { id: "staff", label: "👥 Xodim", icon: "👥" },
    { id: "security", label: "🔒 Xavfsizlik", icon: "🔒" },
    { id: "notification", label: "🔔 Bildirishnoma", icon: "🔔" },
    { id: "kitchen", label: "👨‍🍳 Oshxona", icon: "👨‍🍳" }
  ];

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
        {/* Sidebar */}
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

        {/* Content */}
        <div className="settings-content">
          {renderContent()}
        </div>
      </div>

      {/* Save Button */}
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

  function renderContent() {
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
  }

  function renderGeneralSettings() {
    return (
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
  }

  function renderPrinterSettings() {
    return (
      <div className="settings-panel">
        <h2>🖨️ Printer Sozlamalar</h2>
        
        <div className="toggle-section">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={settings.printer?.enabled || false}
              onChange={(e) => handleChange("printer", "enabled", e.target.checked)}
            />
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
                <span>Avtomatik Chop Qilish</span>
              </label>

              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.printer?.printLogo || false}
                  onChange={(e) => handleChange("printer", "printLogo", e.target.checked)}
                />
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
                Lokal agent yoqilmagan bo'lsa ham tugma backend orqali masofadagi agentga sinov yuboradi. Kanal mos bo'lsin.
              </p>
            )}
          </>
        )}
      </div>
    );
  }
        <button
          className={`tab-btn ${activeTab === "general" ? "active" : ""}`}
          onClick={() => setActiveTab("general")}
        >
          📋 Umumiy
        </button>
        <button
          className={`tab-btn ${activeTab === "printer" ? "active" : ""}`}
          onClick={() => setActiveTab("printer")}
        >
          🖨️ Printer
        </button>
      </div>

      <div className="settings-content">
        {/* Umumiy Sozlamalar */}
        {activeTab === "general" && (
          <div className="settings-panel">
            <h2>Restoran Sozlamalar</h2>
            
            <div className="form-group">
              <label>Restoran Nomi</label>
              <input
                type="text"
                placeholder="Restoran nomini kiriting"
                value={settings.restaurantName || ""}
                onChange={(e) => handleGeneralChange("restaurantName", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Valyuta</label>
              <select
                value={settings.currency || "UZS"}
                onChange={(e) => handleGeneralChange("currency", e.target.value)}
              >
                <option value="UZS">UZS (So'm)</option>
                <option value="USD">USD (Dollar)</option>
                <option value="EUR">EUR (Yevro)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Servis foizi (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.taxRate * 100 || 12}
                onChange={(e) => handleGeneralChange("taxRate", parseFloat(e.target.value) / 100)}
              />
            </div>
          </div>
        )}

        {/* Printer Sozlamalar */}
        {activeTab === "printer" && (
          <div className="settings-panel printer-settings">
            <h2>🖨️ Printer Sozlamalar</h2>

            <div className="printer-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={settings.printerSettings?.enabled || false}
                  onChange={(e) => handlePrinterChange("enabled", e.target.checked)}
                />
                <span>Printerni Faollashtirish</span>
              </label>
            </div>

            {settings.printerSettings?.enabled && (
              <>
                {/* Connection Status */}
                <div className="connection-status">
                  <div className={`status-indicator ${settings.printerSettings?.connectionStatus === "connected" ? "connected" : "disconnected"}`}>
                    <span className="status-dot"></span>
                    <span>{settings.printerSettings?.connectionStatus === "connected" ? "✅ Ulangan" : "❌ Ulanmagan"}</span>
                  </div>
                </div>

                {/* Connection Type */}
                <div className="form-group">
                  <label>Ulanish Turi</label>
                  <select
                    value={settings.printerSettings?.connectionType || "network"}
                    onChange={(e) => handlePrinterChange("connectionType", e.target.value)}
                  >
                    <option value="network">🌐 Network (IP Address)</option>
                    <option value="usb">🔌 USB</option>
                    <option value="bluetooth">📱 Bluetooth</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Printer Nomi</label>
                  <input
                    type="text"
                    placeholder="Printer nomini kiriting"
                    value={settings.printerSettings?.printerName || ""}
                    onChange={(e) => handlePrinterChange("printerName", e.target.value)}
                  />
                </div>

                {/* Network Connection Settings */}
                {settings.printerSettings?.connectionType === "network" && (
                  <div className="network-settings">
                    <h3>🌐 Network Sozlamalar</h3>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label>Printer IP Address</label>
                        <input
                          type="text"
                          placeholder="192.168.1.100"
                          value={settings.printerSettings?.ipAddress || ""}
                          onChange={(e) => handlePrinterChange("ipAddress", e.target.value)}
                        />
                        <small>Printer network IP addressi (masalan: 192.168.1.100)</small>
                      </div>

                      <div className="form-group">
                        <label>Port</label>
                        <input
                          type="number"
                          placeholder="9100"
                          value={settings.printerSettings?.port || 9100}
                          onChange={(e) => handlePrinterChange("port", parseInt(e.target.value))}
                        />
                        <small>Default: 9100</small>
                      </div>
                    </div>

                    <div className="test-buttons">
                      <button 
                        className="test-connection-btn" 
                        onClick={testPrinterConnection}
                        disabled={testingConnection}
                      >
                        {testingConnection ? "Tekshirilmoqda..." : "🔌 Ulanish Tekshirish"}
                      </button>
                      <button 
                        className="test-print-btn" 
                        onClick={testPrintCheck}
                        disabled={testingPrint || settings.printerSettings?.connectionStatus !== "connected"}
                      >
                        {testingPrint ? "Chap bo'lmoqda..." : "🖨️ Test Chap"}
                      </button>
                    </div>
                  </div>
                )}

                <hr style={{ margin: "20px 0" }} />

                <h3>📄 Printer Sozlamalar</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Qog'oz Kengligi</label>
                    <select
                      value={settings.printerSettings?.paperWidth || "80mm"}
                      onChange={(e) => handlePrinterChange("paperWidth", e.target.value)}
                    >
                      <option value="58mm">58mm (Standart)</option>
                      <option value="80mm">80mm (Katta)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Printer Turi</label>
                    <select
                      value={settings.printerSettings?.printerType || "thermal"}
                      onChange={(e) => handlePrinterChange("printerType", e.target.value)}
                    >
                      <option value="thermal">Termal</option>
                      <option value="inkjet">Ink-Jet</option>
                      <option value="laser">Lazer</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.printerSettings?.autoprint || false}
                      onChange={(e) => handlePrinterChange("autoprint", e.target.checked)}
                    />
                    <span>Avtomatik Chap Bosish</span>
                  </label>
                </div>

                <hr style={{ margin: "20px 0" }} />

                <h3>Chek Tuzilmasi</h3>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.printerSettings?.printLogo || false}
                      onChange={(e) => handlePrinterChange("printLogo", e.target.checked)}
                    />
                    <span>Logotip Chap Qilish</span>
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.printerSettings?.printRestaurantName || false}
                      onChange={(e) => handlePrinterChange("printRestaurantName", e.target.checked)}
                    />
                    <span>Restoran Nomini Chap Qilish</span>
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.printerSettings?.printTableNumber || false}
                      onChange={(e) => handlePrinterChange("printTableNumber", e.target.checked)}
                    />
                    <span>Stol Raqamini Chap Qilish</span>
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.printerSettings?.printWaiterName || false}
                      onChange={(e) => handlePrinterChange("printWaiterName", e.target.checked)}
                    />
                    <span>Xizmatchi Nomini Chap Qilish</span>
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.printerSettings?.printTimestamp || false}
                      onChange={(e) => handlePrinterChange("printTimestamp", e.target.checked)}
                    />
                    <span>Vaqtni Chap Qilish</span>
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.printerSettings?.printPaymentMethod || false}
                      onChange={(e) => handlePrinterChange("printPaymentMethod", e.target.checked)}
                    />
                    <span>To'lov Usulini Chap Qilish</span>
                  </label>
                </div>

                <hr style={{ margin: "20px 0" }} />

                <h3>Matn Sozlamalar</h3>

                <div className="form-group">
                  <label>Chek Sarlavhasi</label>
                  <input
                    type="text"
                    placeholder="Sarlavha matni"
                    value={settings.printerSettings?.headerText || ""}
                    onChange={(e) => handlePrinterChange("headerText", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Chek Oxirgi Matni</label>
                  <input
                    type="text"
                    placeholder="Oxirgi matn"
                    value={settings.printerSettings?.footerText || ""}
                    onChange={(e) => handlePrinterChange("footerText", e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="settings-footer">
        {saveMessage && <p className="save-message">{saveMessage}</p>}
        <button 
          className="save-btn" 
          onClick={saveSettings}
          disabled={loading}
        >
          {loading ? "Saqlanmoqda..." : "💾 Saqlash"}
        </button>
      </div>
    </div>
  );
}
