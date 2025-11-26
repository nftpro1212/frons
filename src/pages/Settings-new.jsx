import axios from "axios";
import React, { useEffect, useState } from "react";
import "../styles/Settings.css";

const getAgentBridge = () => (typeof window !== "undefined" ? window.posAgent || null : null);

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    restaurantName: "",
    restaurantAddress: "",
    restaurantPhone: "",
    restaurantEmail: "",
    currency: "UZS",
    language: "uz",
    timezone: "Asia/Tashkent",
    
    taxSettings: {
      enabled: true,
      taxRate: 0.12,
      taxName: "QQS",
      includeInPrice: false,
      serviceCharge: 0,
      serviceChargeEnabled: false
    },
    
    discountSettings: {
      maxDiscountPercent: 50,
      requireManagerApproval: true,
      allowCouponCodes: true
    },
    
    printerSettings: {
      enabled: true,
      connectionType: "network",
      printerName: "Default Printer",
      ipAddress: "192.168.1.100",
      port: 9100,
      paperWidth: "80mm",
      printerType: "thermal",
      autoprint: false,
      printCopies: 1,
      printLogo: true,
      printRestaurantName: true,
      printTableNumber: true,
      printWaiterName: true,
      printTimestamp: true,
      printPaymentMethod: true,
      printQRCode: false,
      headerText: "ZarPOS Restoran",
      footerText: "Raxmat, qayta ko'ring!",
      connectionStatus: "disconnected"
    },
    
    paymentSettings: {
      acceptCash: true,
      acceptCard: true,
      acceptQR: true,
      acceptCrypto: false,
      allowSplitPayment: true,
      allowPartialPayment: false,
      roundingEnabled: true,
      roundingAmount: 100,
      tipEnabled: true,
      suggestedTipPercents: [5, 10, 15, 20]
    },
    
    orderSettings: {
      allowTableOrdering: true,
      allowDelivery: true,
      allowTakeaway: true,
      autoAcceptOrders: false,
      orderTimeout: 30,
      minOrderAmount: 0,
      deliveryFee: 5000,
      freeDeliveryThreshold: 50000
    },
    
    tableSettings: {
      autoAssignTable: false,
      tableSessionTimeout: 180,
      allowTableMerge: true,
      allowTableTransfer: true
    },
    
    staffSettings: {
      requirePinLogin: true,
      pinLength: 4,
      sessionTimeout: 60,
      trackWorkingHours: true,
      allowMultipleLogins: false
    },
    
    securitySettings: {
      requireManagerApproval: {
        forDiscounts: true,
        forVoids: true,
        forRefunds: true,
        forPriceChanges: true
      },
      enableAuditLog: true,
      backupFrequency: "daily",
      dataRetentionDays: 365
    },
    
    notificationSettings: {
      enableNotifications: true,
      soundEnabled: true,
      newOrderAlert: true,
      lowInventoryAlert: true,
      endOfDayAlert: true,
      emailNotifications: false,
      smsNotifications: false
    },
    
    kitchenSettings: {
      enableKitchenDisplay: true,
      autoAcceptOrders: false,
      printToKitchen: true,
      soundAlert: true,
      priorityOrders: true
    }
  });

  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);
  const [testingAgentPrint, setTestingAgentPrint] = useState(false);
  const [agentBridgeAvailable, setAgentBridgeAvailable] = useState(Boolean(getAgentBridge()));

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get("/api/settings");
        setSettings(prev => ({ ...prev, ...res.data }));
      } catch (error) {
        console.error("Sozlamalarni yuklashda xato:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setAgentBridgeAvailable(Boolean(getAgentBridge()));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const resolvePrinterAgentConfig = () => {
    const printer = settings.printerSettings || {};
    const dispatchModeCandidate = printer.dispatchMode || printer.dispatch_mode || "direct";
    const dispatchMode = typeof dispatchModeCandidate === "string" ? dispatchModeCandidate.toLowerCase() : "direct";
    const agentChannel = printer.agentChannel || printer.agent_channel || printer.restaurantId || "default";

    return { dispatchMode, agentChannel };
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      await axios.put("/api/settings", settings);
      setSaveMessage("✅ Sozlamalar saqlandi!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      setSaveMessage("❌ Xato yuz berdi!");
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
        ipAddress: settings.printerSettings?.ipAddress,
        port: settings.printerSettings?.port,
        ...(dispatchMode === "agent"
          ? {
              dispatchMode: "agent",
              agentChannel,
            }
          : {}),
      });
      setSaveMessage(`✅ ${response.data.message}`);
      handleNestedChange("printerSettings", "connectionStatus", "connected");
    } catch (error) {
      setSaveMessage(`❌ ${error.response?.data?.message || "Xatolik yuz berdi"}`);
      handleNestedChange("printerSettings", "connectionStatus", "disconnected");
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
        ipAddress: settings.printerSettings?.ipAddress,
        port: settings.printerSettings?.port,
        ...(dispatchMode === "agent"
          ? {
              dispatchMode: "agent",
              agentChannel,
            }
          : {}),
      });
      setSaveMessage(`✅ ${response.data.message}`);
    } catch (error) {
      setSaveMessage(`❌ ${error.response?.data?.message || "Xatolik yuz berdi"}`);
    } finally {
      setTestingPrint(false);
      setTimeout(() => setSaveMessage(""), 4000);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (parent, field, value) => {
    setSettings(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  const handleDeepNestedChange = (parent, child, field, value) => {
    setSettings(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [child]: { ...prev[parent][child], [field]: value }
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
          ipAddress: settings.printerSettings?.ipAddress,
          port: settings.printerSettings?.port,
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

  if (loading) {
    return (
      <div className="settings-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Yuklanyapti...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "general", icon: "🏪", label: "Umumiy" },
    { id: "tax", icon: "💰", label: "Servis" },
    { id: "payment", icon: "💳", label: "To'lov" },
    { id: "printer", icon: "🖨️", label: "Printer" },
    { id: "orders", icon: "📋", label: "Buyurtmalar" },
    { id: "tables", icon: "🪑", label: "Stollar" },
    { id: "staff", icon: "👥", label: "Xodimlar" },
    { id: "security", icon: "🔒", label: "Xavfsizlik" },
    { id: "notifications", icon: "🔔", label: "Bildirishnomalar" },
    { id: "kitchen", icon: "👨‍🍳", label: "Oshxona" }
  ];

  return (
    <div className="settings-container-modern">
      <div className="settings-header">
        <h1>⚙️ Tizim Sozlamalari</h1>
        <p>POS tizimi sozlamalarini boshqaring</p>
      </div>

      <div className="settings-layout">
        {/* Sidebar Tabs */}
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

        {/* Content Area */}
        <div className="settings-content-modern">
          {/* UMUMIY SOZLAMALAR */}
          {activeTab === "general" && (
            <div className="settings-panel-modern">
              <div className="panel-header">
                <h2>🏪 Umumiy Sozlamalar</h2>
                <p>Restoran haqida asosiy ma'lumotlar</p>
              </div>

              <div className="form-grid">
                <div className="form-group-modern">
                  <label>Restoran Nomi *</label>
                  <input
                    type="text"
                    placeholder="Restoran nomini kiriting"
                    value={settings.restaurantName || ""}
                    onChange={(e) => handleChange("restaurantName", e.target.value)}
                  />
                </div>

                <div className="form-group-modern">
                  <label>Telefon Raqam</label>
                  <input
                    type="tel"
                    placeholder="+998 90 123 45 67"
                    value={settings.restaurantPhone || ""}
                    onChange={(e) => handleChange("restaurantPhone", e.target.value)}
                  />
                </div>

                <div className="form-group-modern full-width">
                  <label>Manzil</label>
                  <input
                    type="text"
                    placeholder="To'liq manzilni kiriting"
                    value={settings.restaurantAddress || ""}
                    onChange={(e) => handleChange("restaurantAddress", e.target.value)}
                  />
                </div>

                <div className="form-group-modern">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={settings.restaurantEmail || ""}
                    onChange={(e) => handleChange("restaurantEmail", e.target.value)}
                  />
                </div>

                <div className="form-group-modern">
                  <label>Valyuta</label>
                  <select
                    value={settings.currency || "UZS"}
                    onChange={(e) => handleChange("currency", e.target.value)}
                  >
                    <option value="UZS">🇺🇿 UZS (So'm)</option>
                    <option value="USD">🇺🇸 USD (Dollar)</option>
                    <option value="EUR">🇪🇺 EUR (Yevro)</option>
                    <option value="RUB">🇷🇺 RUB (Rubl)</option>
                  </select>
                </div>

                <div className="form-group-modern">
                  <label>Til</label>
                  <select
                    value={settings.language || "uz"}
                    onChange={(e) => handleChange("language", e.target.value)}
                  >
                    <option value="uz">🇺🇿 O'zbekcha</option>
                    <option value="ru">🇷🇺 Русский</option>
                    <option value="en">🇬🇧 English</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SERVIS SOZLAMALARI */}
          {activeTab === "tax" && (
            <div className="settings-panel-modern">
              <div className="panel-header">
                <h2>💰 Servis Haqi Sozlamalari</h2>
                <p>Servis foizi va chegirmalar</p>
              </div>

              <div className="toggle-card">
                <div className="toggle-header">
                  <div>
                    <h3>Servis hisoblash</h3>
                    <p>Har bir buyurtmaga servis haqqini qo'shish</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.taxSettings?.enabled || false}
                      onChange={(e) => handleNestedChange("taxSettings", "enabled", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {settings.taxSettings?.enabled && (
                  <div className="toggle-content">
                    <div className="form-grid">
                      <div className="form-group-modern">
                        <label>Servis nomi</label>
                        <input
                          type="text"
                          placeholder="QQS"
                          value={settings.taxSettings?.taxName || ""}
                          onChange={(e) => handleNestedChange("taxSettings", "taxName", e.target.value)}
                        />
                      </div>

                      <div className="form-group-modern">
                        <label>Servis foizi (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={(settings.taxSettings?.taxRate || 0) * 100}
                          onChange={(e) => handleNestedChange("taxSettings", "taxRate", parseFloat(e.target.value) / 100)}
                        />
                      </div>

                      <div className="form-group-modern checkbox">
                        <label>
                          <input
                            type="checkbox"
                            checked={settings.taxSettings?.includeInPrice || false}
                            onChange={(e) => handleNestedChange("taxSettings", "includeInPrice", e.target.checked)}
                          />
                          <span>Servis narxga kiritilgan</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="toggle-card">
                <div className="toggle-header">
                  <div>
                    <h3>Xizmat Haqqi</h3>
                    <p>Buyurtmaga xizmat haqqini qo'shish</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.taxSettings?.serviceChargeEnabled || false}
                      onChange={(e) => handleNestedChange("taxSettings", "serviceChargeEnabled", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {settings.taxSettings?.serviceChargeEnabled && (
                  <div className="toggle-content">
                    <div className="form-group-modern">
                      <label>Xizmat Haqqi (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={settings.taxSettings?.serviceCharge || 0}
                        onChange={(e) => handleNestedChange("taxSettings", "serviceCharge", parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="info-card">
                <h3>📊 Chegirma Sozlamalari</h3>
                <div className="form-grid">
                  <div className="form-group-modern">
                    <label>Maksimal Chegirma (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.discountSettings?.maxDiscountPercent || 0}
                      onChange={(e) => handleNestedChange("discountSettings", "maxDiscountPercent", parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="form-group-modern checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.discountSettings?.requireManagerApproval || false}
                        onChange={(e) => handleNestedChange("discountSettings", "requireManagerApproval", e.target.checked)}
                      />
                      <span>Menejer tasdigi kerak</span>
                    </label>
                  </div>

                  <div className="form-group-modern checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.discountSettings?.allowCouponCodes || false}
                        onChange={(e) => handleNestedChange("discountSettings", "allowCouponCodes", e.target.checked)}
                      />
                      <span>Kupon kodlarni ruxsat berish</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TO'LOV SOZLAMALARI */}
          {activeTab === "payment" && (
            <div className="settings-panel-modern">
              <div className="panel-header">
                <h2>💳 To'lov Sozlamalari</h2>
                <p>To'lov usullari va sozlamalari</p>
              </div>

              <div className="info-card">
                <h3>💵 To'lov Usullari</h3>
                <div className="payment-methods-grid">
                  <label className="payment-method-card">
                    <input
                      type="checkbox"
                      checked={settings.paymentSettings?.acceptCash || false}
                      onChange={(e) => handleNestedChange("paymentSettings", "acceptCash", e.target.checked)}
                    />
                    <div className="method-icon">💵</div>
                    <span>Naqd Pul</span>
                  </label>

                  <label className="payment-method-card">
                    <input
                      type="checkbox"
                      checked={settings.paymentSettings?.acceptCard || false}
                      onChange={(e) => handleNestedChange("paymentSettings", "acceptCard", e.target.checked)}
                    />
                    <div className="method-icon">💳</div>
                    <span>Karta</span>
                  </label>

                  <label className="payment-method-card">
                    <input
                      type="checkbox"
                      checked={settings.paymentSettings?.acceptQR || false}
                      onChange={(e) => handleNestedChange("paymentSettings", "acceptQR", e.target.checked)}
                    />
                    <div className="method-icon">📱</div>
                    <span>QR Code</span>
                  </label>

                  <label className="payment-method-card">
                    <input
                      type="checkbox"
                      checked={settings.paymentSettings?.acceptCrypto || false}
                      onChange={(e) => handleNestedChange("paymentSettings", "acceptCrypto", e.target.checked)}
                    />
                    <div className="method-icon">₿</div>
                    <span>Kripto</span>
                  </label>
                </div>
              </div>

              <div className="info-card">
                <h3>⚙️ To'lov Parametrlari</h3>
                <div className="form-grid">
                  <div className="form-group-modern checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.paymentSettings?.allowSplitPayment || false}
                        onChange={(e) => handleNestedChange("paymentSettings", "allowSplitPayment", e.target.checked)}
                      />
                      <span>Bo'lib to'lashga ruxsat</span>
                    </label>
                  </div>

                  <div className="form-group-modern checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.paymentSettings?.allowPartialPayment || false}
                        onChange={(e) => handleNestedChange("paymentSettings", "allowPartialPayment", e.target.checked)}
                      />
                      <span>Qisman to'lovga ruxsat</span>
                    </label>
                  </div>

                  <div className="form-group-modern checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.paymentSettings?.roundingEnabled || false}
                        onChange={(e) => handleNestedChange("paymentSettings", "roundingEnabled", e.target.checked)}
                      />
                      <span>Yaxlitlash</span>
                    </label>
                  </div>

                  {settings.paymentSettings?.roundingEnabled && (
                    <div className="form-group-modern">
                      <label>Yaxlitlash Miqdori</label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={settings.paymentSettings?.roundingAmount || 100}
                        onChange={(e) => handleNestedChange("paymentSettings", "roundingAmount", parseInt(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="toggle-card">
                <div className="toggle-header">
                  <div>
                    <h3>🎁 Choydon (Tip)</h3>
                    <p>Xizmat uchun choydon qo'shish</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.paymentSettings?.tipEnabled || false}
                      onChange={(e) => handleNestedChange("paymentSettings", "tipEnabled", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* PRINTER SOZLAMALARI */}
          {activeTab === "printer" && (
            <div className="settings-panel-modern">
              <div className="panel-header">
                <h2>🖨️ Printer Sozlamalari</h2>
                <p>Chek printerlash sozlamalari</p>
              </div>

              <div className="toggle-card">
                <div className="toggle-header">
                  <div>
                    <h3>Printerni Faollashtirish</h3>
                    <p>Chek printerlashni yoqish/o'chirish</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.printerSettings?.enabled || false}
                      onChange={(e) => handleNestedChange("printerSettings", "enabled", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {settings.printerSettings?.enabled && (
                  <div className="toggle-content">
                    {/* Connection Status */}
                    <div className="connection-status-modern">
                      <div className={`status-badge ${settings.printerSettings?.connectionStatus === "connected" ? "connected" : "disconnected"}`}>
                        <span className="status-dot"></span>
                        <span>{settings.printerSettings?.connectionStatus === "connected" ? "✅ Ulangan" : "❌ Ulanmagan"}</span>
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="form-group-modern">
                        <label>Ulanish Turi</label>
                        <select
                          value={settings.printerSettings?.connectionType || "network"}
                          onChange={(e) => handleNestedChange("printerSettings", "connectionType", e.target.value)}
                        >
                          <option value="network">🌐 Network (IP Address)</option>
                          <option value="usb">🔌 USB</option>
                          <option value="bluetooth">📱 Bluetooth</option>
                        </select>
                      </div>

                      <div className="form-group-modern">
                        <label>Printer Nomi</label>
                        <input
                          type="text"
                          placeholder="Printer nomini kiriting"
                          value={settings.printerSettings?.printerName || ""}
                          onChange={(e) => handleNestedChange("printerSettings", "printerName", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Network Settings */}
                    {settings.printerSettings?.connectionType === "network" && (
                      <div className="network-card">
                        <h4>🌐 Network Sozlamalar</h4>
                        <div className="form-grid">
                          <div className="form-group-modern">
                            <label>IP Address</label>
                            <input
                              type="text"
                              placeholder="192.168.1.100"
                              value={settings.printerSettings?.ipAddress || ""}
                              onChange={(e) => handleNestedChange("printerSettings", "ipAddress", e.target.value)}
                            />
                          </div>

                          <div className="form-group-modern">
                            <label>Port</label>
                            <input
                              type="number"
                              placeholder="9100"
                              value={settings.printerSettings?.port || 9100}
                              onChange={(e) => handleNestedChange("printerSettings", "port", parseInt(e.target.value))}
                            />
                          </div>
                        </div>

                        <div className="test-buttons-modern">
                          <button 
                            className="btn-test-connection" 
                            onClick={testPrinterConnection}
                            disabled={testingConnection}
                          >
                            {testingConnection ? "⏳ Tekshirilmoqda..." : "🔌 Ulanish Tekshirish"}
                          </button>
                          <button 
                            className="btn-test-print" 
                            onClick={testPrintCheck}
                            disabled={testingPrint}
                          >
                            {testingPrint ? "⏳ Chap bo'lmoqda..." : "🖨️ Test Chap"}
                          </button>
                          <button
                            className="btn-test-print"
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
                          <p className="agent-hint-modern">
                            Lokal agent yoqilmagan bo'lsa ham bu tugma backend orqali masofadagi agentga sinov yuboradi. Kanal nomi mos bo'lsin.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="form-grid">
                      <div className="form-group-modern">
                        <label>Qog'oz Kengligi</label>
                        <select
                          value={settings.printerSettings?.paperWidth || "80mm"}
                          onChange={(e) => handleNestedChange("printerSettings", "paperWidth", e.target.value)}
                        >
                          <option value="58mm">58mm (Standart)</option>
                          <option value="80mm">80mm (Katta)</option>
                        </select>
                      </div>

                      <div className="form-group-modern">
                        <label>Printer Turi</label>
                        <select
                          value={settings.printerSettings?.printerType || "thermal"}
                          onChange={(e) => handleNestedChange("printerSettings", "printerType", e.target.value)}
                        >
                          <option value="thermal">Termal</option>
                          <option value="inkjet">Ink-Jet</option>
                          <option value="laser">Lazer</option>
                        </select>
                      </div>

                      <div className="form-group-modern">
                        <label>Nusxa Soni</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={settings.printerSettings?.printCopies || 1}
                          onChange={(e) => handleNestedChange("printerSettings", "printCopies", parseInt(e.target.value))}
                        />
                      </div>

                      <div className="form-group-modern checkbox">
                        <label>
                          <input
                            type="checkbox"
                            checked={settings.printerSettings?.autoprint || false}
                            onChange={(e) => handleNestedChange("printerSettings", "autoprint", e.target.checked)}
                          />
                          <span>Avtomatik Chap</span>
                        </label>
                      </div>
                    </div>

                    {/* Print Options */}
                    <div className="info-card">
                      <h4>📄 Chek Tuzilmasi</h4>
                      <div className="checkbox-grid">
                        <label>
                          <input
                            type="checkbox"
                            checked={settings.printerSettings?.printLogo || false}
                            onChange={(e) => handleNestedChange("printerSettings", "printLogo", e.target.checked)}
                          />
                          <span>Logotip</span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={settings.printerSettings?.printRestaurantName || false}
                            onChange={(e) => handleNestedChange("printerSettings", "printRestaurantName", e.target.checked)}
                          />
                          <span>Restoran Nomi</span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={settings.printerSettings?.printTableNumber || false}
                            onChange={(e) => handleNestedChange("printerSettings", "printTableNumber", e.target.checked)}
                          />
                          <span>Stol Raqami</span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={settings.printerSettings?.printWaiterName || false}
                            onChange={(e) => handleNestedChange("printerSettings", "printWaiterName", e.target.checked)}
                          />
                          <span>Xizmatchi</span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={settings.printerSettings?.printTimestamp || false}
                            onChange={(e) => handleNestedChange("printerSettings", "printTimestamp", e.target.checked)}
                          />
                          <span>Sana/Vaqt</span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={settings.printerSettings?.printPaymentMethod || false}
                            onChange={(e) => handleNestedChange("printerSettings", "printPaymentMethod", e.target.checked)}
                          />
                          <span>To'lov Usuli</span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={settings.printerSettings?.printQRCode || false}
                            onChange={(e) => handleNestedChange("printerSettings", "printQRCode", e.target.checked)}
                          />
                          <span>QR Code</span>
                        </label>
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="form-group-modern">
                        <label>Chek Sarlavhasi</label>
                        <input
                          type="text"
                          placeholder="Sarlavha matni"
                          value={settings.printerSettings?.headerText || ""}
                          onChange={(e) => handleNestedChange("printerSettings", "headerText", e.target.value)}
                        />
                      </div>

                      <div className="form-group-modern">
                        <label>Chek Oxirgi Matni</label>
                        <input
                          type="text"
                          placeholder="Oxirgi matn"
                          value={settings.printerSettings?.footerText || ""}
                          onChange={(e) => handleNestedChange("printerSettings", "footerText", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BUYURTMA SOZLAMALARI */}
          {activeTab === "orders" && (
            <div className="settings-panel-modern">
              <div className="panel-header">
                <h2>📋 Buyurtma Sozlamalari</h2>
                <p>Buyurtmalar va yetkazib berish sozlamalari</p>
              </div>

              <div className="info-card">
                <h3>📦 Buyurtma Turlari</h3>
                <div className="checkbox-grid">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.orderSettings?.allowTableOrdering || false}
                      onChange={(e) => handleNestedChange("orderSettings", "allowTableOrdering", e.target.checked)}
                    />
                    <span>🪑 Stol buyurtmasi</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.orderSettings?.allowDelivery || false}
                      onChange={(e) => handleNestedChange("orderSettings", "allowDelivery", e.target.checked)}
                    />
                    <span>🚗 Yetkazib berish</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.orderSettings?.allowTakeaway || false}
                      onChange={(e) => handleNestedChange("orderSettings", "allowTakeaway", e.target.checked)}
                    />
                    <span>🛍️ Olib ketish</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.orderSettings?.autoAcceptOrders || false}
                      onChange={(e) => handleNestedChange("orderSettings", "autoAcceptOrders", e.target.checked)}
                    />
                    <span>✅ Avto-qabul</span>
                  </label>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group-modern">
                  <label>Buyurtma Timeout (daq)</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.orderSettings?.orderTimeout || 30}
                    onChange={(e) => handleNestedChange("orderSettings", "orderTimeout", parseInt(e.target.value))}
                  />
                </div>

                <div className="form-group-modern">
                  <label>Minimal Buyurtma Miqdori</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.orderSettings?.minOrderAmount || 0}
                    onChange={(e) => handleNestedChange("orderSettings", "minOrderAmount", parseInt(e.target.value))}
                  />
                </div>

                <div className="form-group-modern">
                  <label>Yetkazib Berish Narxi</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.orderSettings?.deliveryFee || 5000}
                    onChange={(e) => handleNestedChange("orderSettings", "deliveryFee", parseInt(e.target.value))}
                  />
                </div>

                <div className="form-group-modern">
                  <label>Bepul Yetkazib Berish (dan)</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.orderSettings?.freeDeliveryThreshold || 50000}
                    onChange={(e) => handleNestedChange("orderSettings", "freeDeliveryThreshold", parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STOL SOZLAMALARI */}
          {activeTab === "tables" && (
            <div className="settings-panel-modern">
              <div className="panel-header">
                <h2>🪑 Stol Sozlamalari</h2>
                <p>Stol boshqaruvi sozlamalari</p>
              </div>

              <div className="info-card">
                <h3>⚙️ Stol Parametrlari</h3>
                <div className="form-grid">
                  <div className="form-group-modern checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.tableSettings?.autoAssignTable || false}
                        onChange={(e) => handleNestedChange("tableSettings", "autoAssignTable", e.target.checked)}
                      />
                      <span>Avtomatik stol tayinlash</span>
                    </label>
                  </div>

                  <div className="form-group-modern checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.tableSettings?.allowTableMerge || false}
                        onChange={(e) => handleNestedChange("tableSettings", "allowTableMerge", e.target.checked)}
                      />
                      <span>Stollarni birlashtirishga ruxsat</span>
                    </label>
                  </div>

                  <div className="form-group-modern checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.tableSettings?.allowTableTransfer || false}
                        onChange={(e) => handleNestedChange("tableSettings", "allowTableTransfer", e.target.checked)}
                      />
                      <span>Stol o'tkazishga ruxsat</span>
                    </label>
                  </div>

                  <div className="form-group-modern">
                    <label>Stol Sessiya Timeout (daq)</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.tableSettings?.tableSessionTimeout || 180}
                      onChange={(e) => handleNestedChange("tableSettings", "tableSessionTimeout", parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* XODIM SOZLAMALARI */}
          {activeTab === "staff" && (
            <div className="settings-panel-modern">
              <div className="panel-header">
                <h2>👥 Xodim Sozlamalari</h2>
                <p>Xodimlar huquqlari va sessiya sozlamalari</p>
              </div>

              <div className="info-card">
                <h3>🔐 Kirish Sozlamalari</h3>
                <div className="form-grid">
                  <div className="form-group-modern checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.staffSettings?.requirePinLogin || false}
                        onChange={(e) => handleNestedChange("staffSettings", "requirePinLogin", e.target.checked)}
                      />
                      <span>PIN kod talab qilish</span>
                    </label>
                  </div>

                  <div className="form-group-modern">
                    <label>PIN Uzunligi</label>
                    <input
                      type="number"
                      min="4"
                      max="8"
                      value={settings.staffSettings?.pinLength || 4}
                      onChange={(e) => handleNestedChange("staffSettings", "pinLength", parseInt(e.target.value))}
                    />
                  </div>

                  <div className="form-group-modern">
                    <label>Sessiya Timeout (daq)</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.staffSettings?.sessionTimeout || 60}
                      onChange={(e) => handleNestedChange("staffSettings", "sessionTimeout", parseInt(e.target.value))}
                    />
                  </div>

                  <div className="form-group-modern checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.staffSettings?.trackWorkingHours || false}
                        onChange={(e) => handleNestedChange("staffSettings", "trackWorkingHours", e.target.checked)}
                      />
                      <span>Ish vaqtini kuzatish</span>
                    </label>
                  </div>

                  <div className="form-group-modern checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.staffSettings?.allowMultipleLogins || false}
                        onChange={(e) => handleNestedChange("staffSettings", "allowMultipleLogins", e.target.checked)}
                      />
                      <span>Bir vaqtda bir nechta kirish</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* XAVFSIZLIK SOZLAMALARI */}
          {activeTab === "security" && (
            <div className="settings-panel-modern">
              <div className="panel-header">
                <h2>🔒 Xavfsizlik Sozlamalari</h2>
                <p>Tizim xavfsizligi va ma'lumotlarni saqlash</p>
              </div>

              <div className="info-card">
                <h3>✅ Menejer Tasdigi</h3>
                <div className="checkbox-grid">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.securitySettings?.requireManagerApproval?.forDiscounts || false}
                      onChange={(e) => handleDeepNestedChange("securitySettings", "requireManagerApproval", "forDiscounts", e.target.checked)}
                    />
                    <span>Chegirma uchun</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.securitySettings?.requireManagerApproval?.forVoids || false}
                      onChange={(e) => handleDeepNestedChange("securitySettings", "requireManagerApproval", "forVoids", e.target.checked)}
                    />
                    <span>Bekor qilish uchun</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.securitySettings?.requireManagerApproval?.forRefunds || false}
                      onChange={(e) => handleDeepNestedChange("securitySettings", "requireManagerApproval", "forRefunds", e.target.checked)}
                    />
                    <span>Qaytarish uchun</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.securitySettings?.requireManagerApproval?.forPriceChanges || false}
                      onChange={(e) => handleDeepNestedChange("securitySettings", "requireManagerApproval", "forPriceChanges", e.target.checked)}
                    />
                    <span>Narx o'zgartirish uchun</span>
                  </label>
                </div>
              </div>

              <div className="info-card">
                <h3>📊 Ma'lumotlar</h3>
                <div className="form-grid">
                  <div className="form-group-modern checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={settings.securitySettings?.enableAuditLog || false}
                        onChange={(e) => handleNestedChange("securitySettings", "enableAuditLog", e.target.checked)}
                      />
                      <span>Audit log yozish</span>
                    </label>
                  </div>

                  <div className="form-group-modern">
                    <label>Backup Darajasi</label>
                    <select
                      value={settings.securitySettings?.backupFrequency || "daily"}
                      onChange={(e) => handleNestedChange("securitySettings", "backupFrequency", e.target.value)}
                    >
                      <option value="hourly">Soatlik</option>
                      <option value="daily">Kunlik</option>
                      <option value="weekly">Haftalik</option>
                    </select>
                  </div>

                  <div className="form-group-modern">
                    <label>Ma'lumot Saqlash (kun)</label>
                    <input
                      type="number"
                      min="30"
                      value={settings.securitySettings?.dataRetentionDays || 365}
                      onChange={(e) => handleNestedChange("securitySettings", "dataRetentionDays", parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BILDIRISHNOMA SOZLAMALARI */}
          {activeTab === "notifications" && (
            <div className="settings-panel-modern">
              <div className="panel-header">
                <h2>🔔 Bildirishnoma Sozlamalari</h2>
                <p>Tizim bildirish nomalari</p>
              </div>

              <div className="toggle-card">
                <div className="toggle-header">
                  <div>
                    <h3>Bildirishnomalar</h3>
                    <p>Tizim bildirishnomalarini yoqish/o'chirish</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.notificationSettings?.enableNotifications || false}
                      onChange={(e) => handleNestedChange("notificationSettings", "enableNotifications", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {settings.notificationSettings?.enableNotifications && (
                  <div className="toggle-content">
                    <div className="checkbox-grid">
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.notificationSettings?.soundEnabled || false}
                          onChange={(e) => handleNestedChange("notificationSettings", "soundEnabled", e.target.checked)}
                        />
                        <span>🔊 Ovozli ogohlantirish</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.notificationSettings?.newOrderAlert || false}
                          onChange={(e) => handleNestedChange("notificationSettings", "newOrderAlert", e.target.checked)}
                        />
                        <span>📋 Yangi buyurtma</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.notificationSettings?.lowInventoryAlert || false}
                          onChange={(e) => handleNestedChange("notificationSettings", "lowInventoryAlert", e.target.checked)}
                        />
                        <span>📦 Past inventar</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.notificationSettings?.endOfDayAlert || false}
                          onChange={(e) => handleNestedChange("notificationSettings", "endOfDayAlert", e.target.checked)}
                        />
                        <span>🌙 Kun yakunlash</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.notificationSettings?.emailNotifications || false}
                          onChange={(e) => handleNestedChange("notificationSettings", "emailNotifications", e.target.checked)}
                        />
                        <span>📧 Email bildirishnoma</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.notificationSettings?.smsNotifications || false}
                          onChange={(e) => handleNestedChange("notificationSettings", "smsNotifications", e.target.checked)}
                        />
                        <span>📱 SMS bildirishnoma</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OSHXONA SOZLAMALARI */}
          {activeTab === "kitchen" && (
            <div className="settings-panel-modern">
              <div className="panel-header">
                <h2>👨‍🍳 Oshxona Ekrani Sozlamalari</h2>
                <p>Oshxona displey sozlamalari</p>
              </div>

              <div className="toggle-card">
                <div className="toggle-header">
                  <div>
                    <h3>Oshxona Ekrani</h3>
                    <p>Oshxona displayini faollashtirish</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.kitchenSettings?.enableKitchenDisplay || false}
                      onChange={(e) => handleNestedChange("kitchenSettings", "enableKitchenDisplay", e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {settings.kitchenSettings?.enableKitchenDisplay && (
                  <div className="toggle-content">
                    <div className="checkbox-grid">
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.kitchenSettings?.autoAcceptOrders || false}
                          onChange={(e) => handleNestedChange("kitchenSettings", "autoAcceptOrders", e.target.checked)}
                        />
                        <span>✅ Avto-qabul</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.kitchenSettings?.printToKitchen || false}
                          onChange={(e) => handleNestedChange("kitchenSettings", "printToKitchen", e.target.checked)}
                        />
                        <span>🖨️ Oshxonaga chap</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.kitchenSettings?.soundAlert || false}
                          onChange={(e) => handleNestedChange("kitchenSettings", "soundAlert", e.target.checked)}
                        />
                        <span>🔊 Ovozli signal</span>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={settings.kitchenSettings?.priorityOrders || false}
                          onChange={(e) => handleNestedChange("kitchenSettings", "priorityOrders", e.target.checked)}
                        />
                        <span>⭐ Muhim buyurtmalar</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="settings-footer-modern">
        {saveMessage && (
          <div className={`save-message-modern ${saveMessage.includes('✅') ? 'success' : 'error'}`}>
            {saveMessage}
          </div>
        )}
        <button 
          className="btn-save-modern" 
          onClick={saveSettings}
          disabled={loading}
        >
          {loading ? "⏳ Saqlanmoqda..." : "💾 Sozlamalarni Saqlash"}
        </button>
      </div>
    </div>
  );
}
