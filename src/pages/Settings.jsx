import api from "../shared/api";
import React, { useEffect, useState } from "react";
import "./Settings.css";

const getAgentBridge = () => (typeof window !== "undefined" ? window.posAgent || null : null);

const PRINTER_TRIGGER_OPTIONS = [
  { value: "payment", label: "To'lov yopilganda" },
  { value: "order-open", label: "Buyurtma yaratilganda" },
  { value: "order-update", label: "Buyurtma yangilanganda" },
  { value: "kitchen", label: "Oshxona buyurtmasi" },
  { value: "delivery", label: "Dostavka" },
  { value: "test", label: "Test chop" },
];
const isValidObjectId = (value) => typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value.trim());

const createClientId = () => `printer-${Math.random().toString(36).slice(2, 10)}`;

const toPercentValue = (value) => {
  if (value === undefined || value === null) return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const clamped = Math.max(0, numeric);
  if (clamped === 0) return 0;
  const percent = clamped <= 1 ? clamped * 100 : clamped;
  return Number(percent.toFixed(4));
};

const toDecimalValue = (value) => {
  if (value === undefined || value === null) return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const clamped = Math.max(0, numeric);
  if (clamped === 0) return 0;
  const decimal = clamped > 1 ? clamped / 100 : clamped;
  return Number(decimal.toFixed(6));
};

const BASE_RECEIPT_TEMPLATE = {
  fontFamily: "monospace",
  fontSize: 13,
  headerAlign: "center",
  bodyAlign: "left",
  footerAlign: "center",
  accentSymbol: "-",
  dividerStyle: "dashed",
  boldTotals: true,
  showLogo: true,
  showTaxBreakdown: true,
  showDiscount: true,
  showQr: false,
  qrLabel: "",
  qrValue: "",
  lineHeight: 1.4,
  columnsLayout: "two-column",
  customMessage: "",
};

const BASE_PRINTER_DEVICE = {
  name: "Asosiy printer",
  role: "front",
  location: "",
  connectionType: "network",
  dispatchMode: "direct",
  agentChannel: "default",
  ipAddress: "",
  port: 9100,
  paperWidth: "80mm",
  printerType: "thermal",
  autoprint: false,
  autoPrintTriggers: ["payment"],
  copies: 1,
  headerText: "",
  footerText: "",
  logoUrl: "",
  templateOverrides: {},
  enabled: true,
  connectionStatus: "disconnected",
  lastTestPrintDate: null,
  lastConnectionTest: null,
  lastPrintDate: null,
  lastPrintError: "",
  note: "",
};

const createBasePrinterSettings = () => ({
  enabled: true,
  connectionType: "network",
  dispatchMode: "direct",
  printerName: "Asosiy printer",
  ipAddress: "",
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
  lastTestPrintDate: null,
  lastPrintDate: null,
  lastPrintError: "",
  connectionStatus: "disconnected",
  agentChannel: "default",
  printers: [],
  defaultPrinterId: "",
  receiptTemplate: { ...BASE_RECEIPT_TEMPLATE },
});

const BASE_PRINTER_SETTINGS = createBasePrinterSettings();

const createDefaultSettings = () => ({
  _id: "",
  general: {
    restaurantName: "ZarPOS Restoran",
    currency: "UZS",
    language: "uz",
    timezone: "Asia/Tashkent",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
    restaurantAddress: "",
    restaurantPhone: "",
    restaurantEmail: "",
  },
  printerSettings: createBasePrinterSettings(),
  payment: {
    cashEnabled: true,
    cardEnabled: true,
    mobilePaymentEnabled: true,
    allowSplitPayment: true,
    requireSignature: false,
    defaultTipPercent: 10,
    tipEnabled: true,
  },
  tax: {
    enabled: true,
    includeInPrice: false,
    taxName: "Servis haqi",
    taxRate: 0,
    serviceChargeEnabled: false,
    serviceCharge: 0,
    showOnReceipt: true,
  },
  taxIntegration: {
    enabled: false,
    provider: "iiko",
    mode: "sandbox",
    apiBaseUrl: "https://api.iiko.services",
    apiLogin: "demo-pos",
    apiKey: "",
    organizationId: "DEFAULT_ORG",
    defaultVatRate: 12,
    autoFiscalize: true,
  },
  discount: {
    allowDiscounts: true,
    requireManagerApproval: true,
    trackDiscountReasons: false,
    allowCouponCodes: true,
    maxDiscountPercent: 20,
  },
  order: {
    allowModifications: true,
    allowCancellations: true,
    requireCancellationReason: true,
    orderPrefix: "ORD",
    orderStartNumber: 1001,
    autoCompleteTime: 60,
  },
  table: {
    allowTableMerge: true,
    showTableStatus: true,
    tablePrefix: "T",
    defaultTableCapacity: 4,
    tableLayout: "grid",
  },
  staff: {
    requireLogin: true,
    idleTimeout: 30,
    trackWorkHours: true,
    allowClockInOut: true,
    commissionEnabled: false,
    commissionRate: 0,
  },
  security: {
    requireStrongPassword: false,
    allowMultipleSessions: false,
    enableAuditLog: true,
    passwordMinLength: 6,
    sessionTimeout: 60,
    backupFrequency: "daily",
  },
  notification: {
    orderNotifications: true,
    paymentNotifications: true,
    lowStockAlerts: false,
    emailNotifications: false,
    smsNotifications: false,
  },
  kitchen: {
    kitchenDisplay: true,
    autoAssignOrders: true,
    prepTimeTracking: true,
    ingredientTracking: false,
    soundAlerts: true,
  },
  _raw: {
    taxSettings: {},
    paymentSettings: {},
    discountSettings: {},
    orderSettings: {},
    tableSettings: {},
    staffSettings: {},
    securitySettings: {},
    notificationSettings: {},
    kitchenSettings: {},
    printerSettings: {},
    taxIntegration: {},
  },
});

const cloneDeep = (value) => JSON.parse(JSON.stringify(value ?? {}));

const normalizePrinter = (printer = {}, index = 0) => {
  const source = printer?.toObject ? printer.toObject() : { ...printer };
  const normalized = {
    ...BASE_PRINTER_DEVICE,
    ...source,
  };

  normalized.autoPrintTriggers =
    Array.isArray(normalized.autoPrintTriggers) && normalized.autoPrintTriggers.length
      ? Array.from(new Set(normalized.autoPrintTriggers))
      : ["payment"];

  normalized.templateOverrides = normalized.templateOverrides ? { ...normalized.templateOverrides } : {};
  normalized.port = Number(normalized.port) || 9100;
  normalized.copies = Math.max(1, Number(normalized.copies) || 1);

  const idFromDoc = source._id ? source._id.toString() : "";
  normalized.clientId = source.clientId || idFromDoc || createClientId();
  if (source._id) {
    normalized._id = source._id;
  }
  if (!normalized.name || normalized.name === BASE_PRINTER_DEVICE.name) {
    normalized.name = `Printer ${index + 1}`;
  }

  return normalized;
};

const normalizePrinterSettings = (settings = {}, settingsId = "") => {
  const base = createBasePrinterSettings();
  const source = settings?.toObject ? settings.toObject() : { ...settings };

  const merged = {
    ...base,
    ...source,
    receiptTemplate: {
      ...BASE_RECEIPT_TEMPLATE,
      ...(source.receiptTemplate && source.receiptTemplate.toObject
        ? source.receiptTemplate.toObject()
        : source.receiptTemplate || {}),
    },
  };

  const printersArray = Array.isArray(source.printers) ? source.printers : [];
  merged.printers = printersArray.map((printer, index) => normalizePrinter(printer, index));

  if (!merged.printers.length) {
    const fallback = normalizePrinter(
      {
        name: merged.printerName || "Asosiy printer",
        role: "front",
        connectionType: merged.connectionType,
        dispatchMode: merged.dispatchMode,
        agentChannel: merged.agentChannel || settingsId || "default",
        ipAddress: merged.ipAddress,
        port: merged.port,
      },
      0
    );
    merged.printers = [fallback];
    merged.defaultPrinterId = fallback._id ? fallback._id.toString() : "";
  } else {
    merged.defaultPrinterId = source.defaultPrinterId ? source.defaultPrinterId.toString() : merged.defaultPrinterId;
  }

  return merged;
};

const normalizeSettingsData = (data = {}) => {
  const normalized = createDefaultSettings();
  normalized._id = data._id?.toString?.() ?? data._id ?? normalized._id;

  normalized.general = {
    ...normalized.general,
    restaurantName: data.restaurantName ?? normalized.general.restaurantName,
    currency: data.currency ?? normalized.general.currency,
    language: data.language ?? normalized.general.language,
    timezone: data.timezone ?? normalized.general.timezone,
    dateFormat: data.dateFormat ?? normalized.general.dateFormat,
    timeFormat: data.timeFormat ?? normalized.general.timeFormat,
    restaurantAddress: data.restaurantAddress ?? normalized.general.restaurantAddress,
    restaurantPhone: data.restaurantPhone ?? normalized.general.restaurantPhone,
    restaurantEmail: data.restaurantEmail ?? normalized.general.restaurantEmail,
  };

  normalized.printerSettings = normalizePrinterSettings(data.printerSettings || {}, normalized._id);

  const paymentSettings = data.paymentSettings || {};
  normalized.payment = {
    ...normalized.payment,
    cashEnabled: paymentSettings.acceptCash ?? normalized.payment.cashEnabled,
    cardEnabled: paymentSettings.acceptCard ?? normalized.payment.cardEnabled,
    mobilePaymentEnabled: paymentSettings.acceptQR ?? normalized.payment.mobilePaymentEnabled,
    allowSplitPayment: paymentSettings.allowSplitPayment ?? normalized.payment.allowSplitPayment,
    requireSignature: paymentSettings.requireSignature ?? normalized.payment.requireSignature,
    defaultTipPercent:
      Array.isArray(paymentSettings.suggestedTipPercents) && paymentSettings.suggestedTipPercents.length
        ? Number(paymentSettings.suggestedTipPercents[0])
        : normalized.payment.defaultTipPercent,
    tipEnabled: paymentSettings.tipEnabled ?? normalized.payment.tipEnabled,
  };

  const taxSettings = data.taxSettings || {};
  const serviceChargePercent = toPercentValue(taxSettings.serviceCharge);
  const taxRatePercentFromRate = toPercentValue(taxSettings.taxRate);
  const effectiveTaxPercent =
    serviceChargePercent !== undefined ? serviceChargePercent : taxRatePercentFromRate;
  normalized.tax = {
    ...normalized.tax,
    enabled: taxSettings.enabled ?? normalized.tax.enabled,
    includeInPrice: taxSettings.includeInPrice ?? normalized.tax.includeInPrice,
    taxName: taxSettings.taxName ?? normalized.tax.taxName,
    taxRate: effectiveTaxPercent ?? normalized.tax.taxRate,
    serviceChargeEnabled: taxSettings.serviceChargeEnabled ?? normalized.tax.serviceChargeEnabled,
    serviceCharge: serviceChargePercent ?? effectiveTaxPercent ?? normalized.tax.serviceCharge,
    showOnReceipt: taxSettings.showOnReceipt ?? normalized.tax.showOnReceipt,
  };

  normalized.taxIntegration = {
    ...normalized.taxIntegration,
    ...(data.taxIntegration || {}),
  };

  const discountSettings = data.discountSettings || {};
  normalized.discount = {
    ...normalized.discount,
    maxDiscountPercent: Number.isFinite(Number(discountSettings.maxDiscountPercent))
      ? Number(discountSettings.maxDiscountPercent)
      : normalized.discount.maxDiscountPercent,
    requireManagerApproval:
      discountSettings.requireManagerApproval ?? normalized.discount.requireManagerApproval,
    allowCouponCodes: discountSettings.allowCouponCodes ?? normalized.discount.allowCouponCodes,
    allowDiscounts: discountSettings.allowDiscounts ?? normalized.discount.allowDiscounts,
    trackDiscountReasons:
      discountSettings.trackDiscountReasons ?? normalized.discount.trackDiscountReasons,
  };

  const orderSettings = data.orderSettings || {};
  normalized.order = {
    ...normalized.order,
    allowModifications: orderSettings.allowModifications ?? normalized.order.allowModifications,
    allowCancellations: orderSettings.allowCancellations ?? normalized.order.allowCancellations,
    requireCancellationReason:
      orderSettings.requireCancellationReason ?? normalized.order.requireCancellationReason,
    orderPrefix: orderSettings.orderPrefix ?? normalized.order.orderPrefix,
    orderStartNumber: Number.isFinite(Number(orderSettings.orderStartNumber))
      ? Number(orderSettings.orderStartNumber)
      : normalized.order.orderStartNumber,
    autoCompleteTime: Number.isFinite(Number(orderSettings.autoCompleteTime))
      ? Number(orderSettings.autoCompleteTime)
      : normalized.order.autoCompleteTime,
  };

  const tableSettings = data.tableSettings || {};
  normalized.table = {
    ...normalized.table,
    allowTableMerge: tableSettings.allowTableMerge ?? normalized.table.allowTableMerge,
    showTableStatus: tableSettings.showTableStatus ?? normalized.table.showTableStatus,
    tablePrefix: tableSettings.tablePrefix ?? normalized.table.tablePrefix,
    defaultTableCapacity: Number.isFinite(Number(tableSettings.defaultTableCapacity))
      ? Number(tableSettings.defaultTableCapacity)
      : normalized.table.defaultTableCapacity,
    tableLayout: tableSettings.tableLayout ?? normalized.table.tableLayout,
  };

  const staffSettings = data.staffSettings || {};
  normalized.staff = {
    ...normalized.staff,
    requireLogin: staffSettings.requirePinLogin ?? normalized.staff.requireLogin,
    trackWorkHours: staffSettings.trackWorkingHours ?? normalized.staff.trackWorkHours,
    allowClockInOut: staffSettings.allowMultipleLogins ?? normalized.staff.allowClockInOut,
    commissionEnabled: staffSettings.commissionEnabled ?? normalized.staff.commissionEnabled,
    idleTimeout: Number.isFinite(Number(staffSettings.sessionTimeout))
      ? Number(staffSettings.sessionTimeout)
      : normalized.staff.idleTimeout,
    commissionRate: Number.isFinite(Number(staffSettings.commissionRate))
      ? Number(staffSettings.commissionRate)
      : normalized.staff.commissionRate,
  };

  const securitySettings = data.securitySettings || {};
  normalized.security = {
    ...normalized.security,
    requireStrongPassword:
      securitySettings.requireStrongPassword ?? normalized.security.requireStrongPassword,
    allowMultipleSessions:
      securitySettings.allowMultipleSessions ?? normalized.security.allowMultipleSessions,
    enableAuditLog: securitySettings.enableAuditLog ?? normalized.security.enableAuditLog,
    passwordMinLength: Number.isFinite(Number(securitySettings.passwordMinLength))
      ? Number(securitySettings.passwordMinLength)
      : normalized.security.passwordMinLength,
    sessionTimeout: Number.isFinite(Number(securitySettings.sessionTimeout))
      ? Number(securitySettings.sessionTimeout)
      : normalized.security.sessionTimeout,
    backupFrequency: securitySettings.backupFrequency ?? normalized.security.backupFrequency,
  };

  const notificationSettings = data.notificationSettings || {};
  normalized.notification = {
    ...normalized.notification,
    orderNotifications:
      notificationSettings.newOrderAlert ?? notificationSettings.orderNotifications ?? normalized.notification.orderNotifications,
    paymentNotifications:
      notificationSettings.enableNotifications ?? normalized.notification.paymentNotifications,
    lowStockAlerts:
      notificationSettings.lowInventoryAlert ?? notificationSettings.lowStockAlerts ?? normalized.notification.lowStockAlerts,
    emailNotifications:
      notificationSettings.emailNotifications ?? normalized.notification.emailNotifications,
    smsNotifications:
      notificationSettings.smsNotifications ?? normalized.notification.smsNotifications,
  };

  const kitchenSettings = data.kitchenSettings || {};
  normalized.kitchen = {
    ...normalized.kitchen,
    kitchenDisplay: kitchenSettings.enableKitchenDisplay ?? normalized.kitchen.kitchenDisplay,
    autoAssignOrders: kitchenSettings.autoAssignOrders ?? normalized.kitchen.autoAssignOrders,
    prepTimeTracking: kitchenSettings.prepTimeTracking ?? normalized.kitchen.prepTimeTracking,
    ingredientTracking: kitchenSettings.ingredientTracking ?? normalized.kitchen.ingredientTracking,
    soundAlerts: kitchenSettings.soundAlert ?? kitchenSettings.soundAlerts ?? normalized.kitchen.soundAlerts,
  };

  normalized._raw = {
    taxSettings: cloneDeep(data.taxSettings),
    paymentSettings: cloneDeep(data.paymentSettings),
    discountSettings: cloneDeep(data.discountSettings),
    orderSettings: cloneDeep(data.orderSettings),
    tableSettings: cloneDeep(data.tableSettings),
    staffSettings: cloneDeep(data.staffSettings),
    securitySettings: cloneDeep(data.securitySettings),
    notificationSettings: cloneDeep(data.notificationSettings),
    kitchenSettings: cloneDeep(data.kitchenSettings),
    printerSettings: cloneDeep(data.printerSettings),
    taxIntegration: cloneDeep(data.taxIntegration),
  };

  return normalized;
};

const sanitizePrinterSettings = (currentSettings, rawSettings = {}) => {
  const base = {
    ...createBasePrinterSettings(),
    ...rawSettings,
  };

  base.enabled = Boolean(currentSettings?.enabled);
  base.connectionType = currentSettings?.connectionType || base.connectionType;
  base.dispatchMode = currentSettings?.dispatchMode || base.dispatchMode;
  base.printerName = currentSettings?.printerName || base.printerName;
  base.ipAddress = currentSettings?.ipAddress || base.ipAddress;
  base.port = Number(currentSettings?.port ?? base.port ?? 9100);
  base.paperWidth = currentSettings?.paperWidth || base.paperWidth;
  base.printerType = currentSettings?.printerType || base.printerType;
  base.autoprint = Boolean(currentSettings?.autoprint);
  base.printCopies = Math.max(1, Number(currentSettings?.printCopies ?? base.printCopies ?? 1));
  base.printLogo = Boolean(currentSettings?.printLogo ?? base.printLogo);
  base.printRestaurantName = Boolean(currentSettings?.printRestaurantName ?? base.printRestaurantName);
  base.printTableNumber = Boolean(currentSettings?.printTableNumber ?? base.printTableNumber);
  base.printWaiterName = Boolean(currentSettings?.printWaiterName ?? base.printWaiterName);
  base.printTimestamp = Boolean(currentSettings?.printTimestamp ?? base.printTimestamp);
  base.printPaymentMethod = Boolean(currentSettings?.printPaymentMethod ?? base.printPaymentMethod);
  base.printQRCode = Boolean(currentSettings?.printQRCode ?? base.printQRCode);
  base.headerText = currentSettings?.headerText ?? base.headerText;
  base.footerText = currentSettings?.footerText ?? base.footerText;
  base.agentChannel = currentSettings?.agentChannel || base.agentChannel || "default";
  base.receiptTemplate = {
    ...BASE_RECEIPT_TEMPLATE,
    ...(rawSettings?.receiptTemplate || {}),
    ...(currentSettings?.receiptTemplate || {}),
  };

  const printers = Array.isArray(currentSettings?.printers) ? currentSettings.printers : [];
  base.printers = printers.map((printer) => {
    const source = printer?.toObject ? printer.toObject() : { ...printer };
    const {
      clientId,
      connectionStatus,
      lastTestPrintDate,
      lastConnectionTest,
      lastPrintDate,
      lastPrintError,
      ...rest
    } = source;

    const sanitized = {
      ...BASE_PRINTER_DEVICE,
      ...rest,
    };

    sanitized.port = Number(rest.port) || 9100;
    sanitized.copies = Math.max(1, Number(rest.copies) || 1);
    sanitized.autoPrintTriggers =
      Array.isArray(rest.autoPrintTriggers) && rest.autoPrintTriggers.length
        ? Array.from(new Set(rest.autoPrintTriggers))
        : ["payment"];
    sanitized.templateOverrides = rest.templateOverrides || {};

    if (printer._id) {
      sanitized._id = printer._id;
    }

    return sanitized;
  });

  const defaultPrinterId = currentSettings?.defaultPrinterId || rawSettings?.defaultPrinterId || "";
  base.defaultPrinterId = isValidObjectId(defaultPrinterId) ? defaultPrinterId : null;

  return base;
};

const sanitizeSettingsForSave = (currentSettings) => {
  const servicePercentRaw =
    currentSettings.tax?.serviceCharge ?? currentSettings.tax?.taxRate ?? 0;
  const serviceDecimal = toDecimalValue(servicePercentRaw);

  const payload = {
    restaurantName: currentSettings.general?.restaurantName || "",
    currency: currentSettings.general?.currency || "UZS",
    language: currentSettings.general?.language || "uz",
    timezone: currentSettings.general?.timezone || "Asia/Tashkent",
    dateFormat: currentSettings.general?.dateFormat || "DD/MM/YYYY",
    timeFormat: currentSettings.general?.timeFormat || "24h",
    restaurantAddress: currentSettings.general?.restaurantAddress || "",
    restaurantPhone: currentSettings.general?.restaurantPhone || "",
    restaurantEmail: currentSettings.general?.restaurantEmail || "",
    printerSettings: sanitizePrinterSettings(
      currentSettings.printerSettings,
      currentSettings._raw?.printerSettings
    ),
    paymentSettings: {
      ...(currentSettings._raw?.paymentSettings || {}),
      acceptCash: Boolean(currentSettings.payment?.cashEnabled),
      acceptCard: Boolean(currentSettings.payment?.cardEnabled),
      acceptQR: Boolean(currentSettings.payment?.mobilePaymentEnabled),
      allowSplitPayment: Boolean(currentSettings.payment?.allowSplitPayment),
      tipEnabled: Boolean(currentSettings.payment?.tipEnabled),
      suggestedTipPercents: [
        Number(currentSettings.payment?.defaultTipPercent || 0),
        ...(Array.isArray(currentSettings._raw?.paymentSettings?.suggestedTipPercents)
          ? currentSettings._raw.paymentSettings.suggestedTipPercents.slice(1)
          : []),
      ],
    },
    taxSettings: {
      ...(currentSettings._raw?.taxSettings || {}),
      enabled: Boolean(
        currentSettings.tax?.enabled ?? currentSettings.tax?.serviceChargeEnabled
      ),
      includeInPrice: Boolean(currentSettings.tax?.includeInPrice),
      taxName: currentSettings.tax?.taxName || "",
      taxRate: serviceDecimal ?? 0,
      serviceChargeEnabled: Boolean(currentSettings.tax?.serviceChargeEnabled),
      serviceCharge: serviceDecimal ?? 0,
      showOnReceipt: Boolean(currentSettings.tax?.showOnReceipt),
    },
    taxIntegration: {
      ...(currentSettings._raw?.taxIntegration || {}),
      ...(currentSettings.taxIntegration || {}),
    },
    discountSettings: {
      ...(currentSettings._raw?.discountSettings || {}),
      allowDiscounts: Boolean(currentSettings.discount?.allowDiscounts),
      requireManagerApproval: Boolean(currentSettings.discount?.requireManagerApproval),
      trackDiscountReasons: Boolean(currentSettings.discount?.trackDiscountReasons),
      allowCouponCodes: Boolean(currentSettings.discount?.allowCouponCodes),
      maxDiscountPercent: Number(currentSettings.discount?.maxDiscountPercent || 0),
    },
    orderSettings: {
      ...(currentSettings._raw?.orderSettings || {}),
      allowModifications: Boolean(currentSettings.order?.allowModifications),
      allowCancellations: Boolean(currentSettings.order?.allowCancellations),
      requireCancellationReason: Boolean(currentSettings.order?.requireCancellationReason),
      orderPrefix: currentSettings.order?.orderPrefix || "",
      orderStartNumber: Number(currentSettings.order?.orderStartNumber || 0),
      autoCompleteTime: Number(currentSettings.order?.autoCompleteTime || 0),
    },
    tableSettings: {
      ...(currentSettings._raw?.tableSettings || {}),
      allowTableMerge: Boolean(currentSettings.table?.allowTableMerge),
      showTableStatus: Boolean(currentSettings.table?.showTableStatus),
      tablePrefix: currentSettings.table?.tablePrefix || "",
      defaultTableCapacity: Number(currentSettings.table?.defaultTableCapacity || 0),
      tableLayout:
        currentSettings.table?.tableLayout ||
        currentSettings._raw?.tableSettings?.tableLayout ||
        "grid",
    },
    staffSettings: {
      ...(currentSettings._raw?.staffSettings || {}),
      requirePinLogin: Boolean(currentSettings.staff?.requireLogin),
      trackWorkingHours: Boolean(currentSettings.staff?.trackWorkHours),
      allowMultipleLogins: Boolean(currentSettings.staff?.allowClockInOut),
      sessionTimeout: Number(currentSettings.staff?.idleTimeout || 0),
      commissionEnabled: Boolean(currentSettings.staff?.commissionEnabled),
      commissionRate: Number(currentSettings.staff?.commissionRate || 0),
    },
    securitySettings: {
      ...(currentSettings._raw?.securitySettings || {}),
      requireStrongPassword: Boolean(currentSettings.security?.requireStrongPassword),
      allowMultipleSessions: Boolean(currentSettings.security?.allowMultipleSessions),
      enableAuditLog: Boolean(currentSettings.security?.enableAuditLog),
      passwordMinLength: Number(currentSettings.security?.passwordMinLength || 6),
      sessionTimeout: Number(currentSettings.security?.sessionTimeout || 60),
      backupFrequency: currentSettings.security?.backupFrequency || "daily",
    },
    notificationSettings: {
      ...(currentSettings._raw?.notificationSettings || {}),
      enableNotifications: Boolean(currentSettings.notification?.paymentNotifications ?? currentSettings._raw?.notificationSettings?.enableNotifications),
      newOrderAlert: Boolean(currentSettings.notification?.orderNotifications),
      lowInventoryAlert: Boolean(
        currentSettings.notification?.lowStockAlerts ??
          currentSettings._raw?.notificationSettings?.lowInventoryAlert
      ),
      emailNotifications: Boolean(currentSettings.notification?.emailNotifications),
      smsNotifications: Boolean(currentSettings.notification?.smsNotifications),
    },
    kitchenSettings: {
      ...(currentSettings._raw?.kitchenSettings || {}),
      enableKitchenDisplay: Boolean(currentSettings.kitchen?.kitchenDisplay),
      autoAssignOrders: Boolean(currentSettings.kitchen?.autoAssignOrders),
      prepTimeTracking: Boolean(currentSettings.kitchen?.prepTimeTracking),
      ingredientTracking: Boolean(currentSettings.kitchen?.ingredientTracking),
      soundAlert: Boolean(currentSettings.kitchen?.soundAlerts),
    },
  };

  if (payload.printerSettings && !isValidObjectId(payload.printerSettings.defaultPrinterId)) {
    payload.printerSettings.defaultPrinterId = null;
  }

  return payload;
};

const formatDateTime = (value) => {
  if (!value) return "—";
  try {
    const dateValue = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(dateValue.getTime())) return "—";
    return dateValue.toLocaleString("uz-UZ");
  } catch (err) {
    return "—";
  }
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(() => createDefaultSettings());

  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingPrint, setTestingPrint] = useState(false);
  const [testingAgentPrint, setTestingAgentPrint] = useState(false);
  const [agentBridgeAvailable, setAgentBridgeAvailable] = useState(Boolean(getAgentBridge()));
  const [testingTaxIntegration, setTestingTaxIntegration] = useState(false);
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const saveMessageTone = saveMessage.startsWith("✅") ? "success" : saveMessage.startsWith("❌") ? "danger" : "info";
  
  // Staff management states
  const [staffList, setStaffList] = useState([]);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({
    name: "",
    role: "ofitsiant",
    pinCode: ""
  });

  useEffect(() => {
    fetchSettings();
    if (activeTab === "staff") {
      fetchStaffList();
    }
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAgentBridgeAvailable(Boolean(getAgentBridge()));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const resolvePrinterAgentConfig = (printer) => {
    const dispatchModeCandidate = printer?.dispatchMode || settings.printerSettings?.dispatchMode || "direct";
    const dispatchMode = typeof dispatchModeCandidate === "string" ? dispatchModeCandidate.toLowerCase() : "direct";
    const agentChannel =
      printer?.agentChannel || settings.printerSettings?.agentChannel || settings._id || "default";

    return {
      dispatchMode,
      agentChannel,
    };
  };

  useEffect(() => {
    const printers = settings.printerSettings?.printers || [];
    if (!printers.length) {
      if (selectedPrinterId) {
        setSelectedPrinterId("");
      }
      return;
    }

    const exists = printers.some((printer) => {
      const id = printer.clientId || printer._id?.toString();
      return id === selectedPrinterId;
    });

    if (!exists) {
      const nextId = printers[0].clientId || printers[0]._id?.toString() || "";
      if (nextId) {
        setSelectedPrinterId(nextId);
      }
    }
  }, [settings.printerSettings?.printers, selectedPrinterId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/settings");
      if (res.data) {
        const normalized = normalizeSettingsData(res.data);
        setSettings(normalized);

        const printerSettings = normalized.printerSettings || {};
        const printers = printerSettings.printers || [];
        const defaultId = printerSettings.defaultPrinterId;
        const fallbackId = printers[0]?.clientId || "";
        const resolvedId = printers.find((printer) => printer.clientId === defaultId || printer._id?.toString() === defaultId)
          ? defaultId
          : fallbackId;
        setSelectedPrinterId(resolvedId || "");
      }
    } catch (error) {
      console.error("Sozlamalarni yuklashda xato:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffList = async () => {
    try {
      const res = await api.get("/auth/staff");
      setStaffList(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Xodimlarni yuklashda xato:", error);
      setStaffList([]);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      const payload = sanitizeSettingsForSave(settings);
      await api.put("/settings", payload);
      await fetchSettings();
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
    const printers = settings.printerSettings?.printers || [];
    const activePrinter = printers.find(
      (printer) => printer.clientId === selectedPrinterId || printer._id?.toString() === selectedPrinterId
    ) || printers[0];

    if (!activePrinter) {
      setSaveMessage("❌ Printer tanlanmagan");
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }

    const { dispatchMode, agentChannel } = resolvePrinterAgentConfig(activePrinter);

    try {
      setTestingConnection(true);
      const response = await api.post("/settings/test-printer-connection", {
        printerId: activePrinter._id,
        ipAddress: activePrinter.ipAddress,
        port: activePrinter.port,
        ...(dispatchMode === "agent"
          ? {
              dispatchMode: "agent",
              agentChannel,
            }
          : {}),
      });
      setSaveMessage(`✅ ${response.data.message}`);
      const nowIso = new Date().toISOString();
      setSettings((prev) => {
        const nextPrinters = (prev.printerSettings?.printers || []).map((printer) => {
          const isMatch = printer.clientId === activePrinter.clientId || printer._id?.toString() === activePrinter._id?.toString();
          if (!isMatch) return printer;
          return {
            ...printer,
            connectionStatus: "connected",
            lastConnectionTest: nowIso,
            ipAddress: activePrinter.ipAddress,
            port: activePrinter.port,
          };
        });

        return {
          ...prev,
          printerSettings: {
            ...prev.printerSettings,
            connectionStatus: "connected",
            lastConnectionTest: nowIso,
            ipAddress: activePrinter.ipAddress,
            port: activePrinter.port,
            printers: nextPrinters,
          },
        };
      });
    } catch (error) {
      setSaveMessage(`❌ ${error.response?.data?.message || "Printerga ulanib bo'lmadi"}`);
      const nowIso = new Date().toISOString();
      setSettings((prev) => {
        const nextPrinters = (prev.printerSettings?.printers || []).map((printer) => {
          const isMatch = printer.clientId === activePrinter.clientId || printer._id?.toString() === activePrinter._id?.toString();
          if (!isMatch) return printer;
          return {
            ...printer,
            connectionStatus: "disconnected",
            lastConnectionTest: nowIso,
            lastPrintError: error.response?.data?.message || error.message || "Aloqa xatosi",
          };
        });

        return {
          ...prev,
          printerSettings: {
            ...prev.printerSettings,
            connectionStatus: "disconnected",
            lastConnectionTest: nowIso,
            lastPrintError: error.response?.data?.message || error.message || "Aloqa xatosi",
            printers: nextPrinters,
          },
        };
      });
    } finally {
      setTestingConnection(false);
      setTimeout(() => setSaveMessage(""), 4000);
    }
  };

  const testPrintCheck = async () => {
    const printers = settings.printerSettings?.printers || [];
    const activePrinter = printers.find(
      (printer) => printer.clientId === selectedPrinterId || printer._id?.toString() === selectedPrinterId
    ) || printers[0];

    if (!activePrinter) {
      setSaveMessage("❌ Printer tanlanmagan");
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }

    const { dispatchMode, agentChannel } = resolvePrinterAgentConfig(activePrinter);

    try {
      setTestingPrint(true);
      const response = await api.post("/settings/test-print-check", {
        printerId: activePrinter._id,
        ipAddress: activePrinter.ipAddress,
        port: activePrinter.port,
        ...(dispatchMode === "agent"
          ? {
              dispatchMode: "agent",
              agentChannel,
            }
          : {}),
      });
      setSaveMessage(`✅ ${response.data.message}`);
      const nowIso = new Date().toISOString();
      setSettings((prev) => {
        const nextPrinters = (prev.printerSettings?.printers || []).map((printer) => {
          const isMatch = printer.clientId === activePrinter.clientId || printer._id?.toString() === activePrinter._id?.toString();
          if (!isMatch) return printer;
          return {
            ...printer,
            connectionStatus: "connected",
            lastTestPrintDate: nowIso,
            lastPrintDate: nowIso,
            lastPrintError: "",
          };
        });

        return {
          ...prev,
          printerSettings: {
            ...prev.printerSettings,
            lastTestPrintDate: nowIso,
            lastPrintDate: nowIso,
            lastPrintError: "",
            printers: nextPrinters,
          },
        };
      });
    } catch (error) {
      setSaveMessage(`❌ ${error.response?.data?.message || "Chekni chop qilib bo'lmadi"}`);
      setSettings((prev) => {
        const nextPrinters = (prev.printerSettings?.printers || []).map((printer) => {
          const isMatch = printer.clientId === activePrinter.clientId || printer._id?.toString() === activePrinter._id?.toString();
          if (!isMatch) return printer;
          return {
            ...printer,
            connectionStatus: "disconnected",
            lastPrintError: error.response?.data?.message || error.message || "Chek chop xatosi",
          };
        });

        return {
          ...prev,
          printerSettings: {
            ...prev.printerSettings,
            lastPrintError: error.response?.data?.message || error.message || "Chek chop xatosi",
            printers: nextPrinters,
          },
        };
      });
    } finally {
      setTestingPrint(false);
      setTimeout(() => setSaveMessage(""), 4000);
    }
  };

  const testAgentPrint = async () => {
    const agent = getAgentBridge();
    const printers = settings.printerSettings?.printers || [];
    const activePrinter = printers.find(
      (printer) => printer.clientId === selectedPrinterId || printer._id?.toString() === selectedPrinterId
    ) || printers[0];

    if (!activePrinter) {
      setSaveMessage("❌ Printer tanlanmagan");
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }

    const printerId = activePrinter._id?.toString() || activePrinter.clientId || activePrinter.id;
    const { agentChannel } = resolvePrinterAgentConfig(activePrinter);

    try {
      setTestingAgentPrint(true);
      if (agent) {
        await agent.printTest(printerId ? { printerId } : undefined);
        setSaveMessage("✅ Agent orqali test yuborildi");
      } else {
        const response = await api.post("/settings/test-print-check", {
          printerId: activePrinter._id,
          ipAddress: activePrinter.ipAddress,
          port: activePrinter.port,
          dispatchMode: "agent",
          agentChannel,
        });
        setSaveMessage(`✅ ${response.data?.message || "Agentga yuborildi"}`);
      }
    } catch (error) {
      console.error("Agent test print xatosi", error);
      setSaveMessage(`❌ ${error?.response?.data?.message || error?.message || "Agent test xatosi"}`);
    } finally {
      setTestingAgentPrint(false);
      setTimeout(() => setSaveMessage(""), 4000);
    }
  };

  const testTaxIntegrationConnection = async () => {
    if (!settings.taxIntegration?.enabled) {
      setSaveMessage("❌ Soliq integratsiyasi o'chirilgan");
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }

    try {
      setTestingTaxIntegration(true);
      const response = await api.post("/settings/test-tax-integration", settings.taxIntegration);
      setSaveMessage(`✅ ${response.data.message || "Integratsiya ishladi"}`);
    } catch (error) {
      setSaveMessage(`❌ ${error.response?.data?.message || "Integratsiya testidan o'tmadi"}`);
    } finally {
      setTestingTaxIntegration(false);
      setTimeout(() => setSaveMessage(""), 4000);
    }
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

  const handleServiceToggle = (checked) => {
    setSettings((prev) => ({
      ...prev,
      tax: {
        ...prev.tax,
        serviceChargeEnabled: checked,
        enabled: checked,
      },
    }));
  };

  const handleServiceRateChange = (value) => {
    const sanitized = Number.isFinite(value) ? value : 0;
    setSettings((prev) => ({
      ...prev,
      tax: {
        ...prev.tax,
        serviceCharge: sanitized,
        taxRate: sanitized,
      },
    }));
  };

  const updatePrinter = (printerId, updater) => {
    setSettings((prev) => {
      const prevPrinters = prev.printerSettings?.printers || [];
      const nextPrinters = prevPrinters.map((printer, index) => {
        const candidateId = printer.clientId || printer._id?.toString();
        if (candidateId !== printerId) return printer;

        const patch = typeof updater === "function" ? updater(printer, index) : updater;
        const updated = { ...printer, ...patch };

        updated.autoPrintTriggers = Array.isArray(updated.autoPrintTriggers) && updated.autoPrintTriggers.length
          ? Array.from(new Set(updated.autoPrintTriggers))
          : ["payment"];
        updated.templateOverrides = updated.templateOverrides || {};
        updated.port = Number(updated.port) || 9100;
        updated.copies = Math.max(1, Number(updated.copies) || 1);

        if (!updated.name) {
          updated.name = printer.name || `Printer ${index + 1}`;
        }

        return updated;
      });

      return {
        ...prev,
        printerSettings: {
          ...prev.printerSettings,
          printers: nextPrinters,
        },
      };
    });
  };

  const handlePrinterFieldChange = (printerId, field, value) => {
    updatePrinter(printerId, { [field]: value });
  };

  const handleTemplateOverrideChange = (printerId, field, value) => {
    updatePrinter(printerId, (printer) => ({
      templateOverrides: {
        ...printer.templateOverrides,
        [field]: value,
      },
    }));
  };

  const handleReceiptTemplateChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      printerSettings: {
        ...prev.printerSettings,
        receiptTemplate: {
          ...(prev.printerSettings?.receiptTemplate || {}),
          [field]: value,
        },
      },
    }));
  };

  const togglePrinterTrigger = (printerId, trigger) => {
    updatePrinter(printerId, (printer) => {
      const current = Array.isArray(printer.autoPrintTriggers) ? [...printer.autoPrintTriggers] : [];
      const hasTrigger = current.includes(trigger);
      const nextTriggers = hasTrigger ? current.filter((value) => value !== trigger) : [...current, trigger];
      return {
        autoPrintTriggers: nextTriggers.length ? nextTriggers : ["payment"],
      };
    });
  };

  const handleAddPrinter = () => {
    let createdPrinter = null;
    setSettings((prev) => {
      const prevPrinters = prev.printerSettings?.printers || [];
      createdPrinter = normalizePrinter(
        {
          ...BASE_PRINTER_DEVICE,
          name: `Printer ${prevPrinters.length + 1}`,
          headerText: prev.printerSettings?.headerText || "",
          footerText: prev.printerSettings?.footerText || "",
        },
        prevPrinters.length
      );

      return {
        ...prev,
        printerSettings: {
          ...prev.printerSettings,
          printers: [...prevPrinters, createdPrinter],
        },
      };
    });

    if (createdPrinter) {
      setSelectedPrinterId(createdPrinter.clientId);
    }
  };

  const handleRemovePrinter = (printerId) => {
    let nextSelectedId = "";

    setSettings((prev) => {
      const prevPrinters = prev.printerSettings?.printers || [];
      if (prevPrinters.length <= 1) {
        return prev;
      }

      const nextPrinters = prevPrinters.filter((printer) => {
        const candidateId = printer.clientId || printer._id?.toString();
        return candidateId !== printerId;
      });

      const removedWasDefault = prev.printerSettings?.defaultPrinterId
        ? prev.printerSettings.defaultPrinterId === printerId || prev.printerSettings.defaultPrinterId === prevPrinters.find((printer) => (printer.clientId || printer._id?.toString()) === printerId)?._id?.toString()
        : false;

      const nextDefaultId = removedWasDefault ? "" : prev.printerSettings?.defaultPrinterId;

      nextSelectedId = (() => {
        if (!nextPrinters.length) return "";
        const currentSelected = selectedPrinterId;
        const stillExists = nextPrinters.find((printer) => {
          const id = printer.clientId || printer._id?.toString();
          return id === currentSelected;
        });
        if (stillExists) return currentSelected;
        return nextPrinters[0].clientId || nextPrinters[0]._id?.toString() || "";
      })();

      return {
        ...prev,
        printerSettings: {
          ...prev.printerSettings,
          printers: nextPrinters,
          defaultPrinterId: nextDefaultId,
        },
      };
    });

    setSelectedPrinterId(nextSelectedId);
  };

  const handleSelectPrinter = (printerId) => {
    setSelectedPrinterId(printerId);
  };

  const handleSetDefaultPrinter = (printer) => {
    if (!printer?._id) {
      setSaveMessage("❌ Avval printerni saqlang, so'ng default qilib belgilang");
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }
    const idString = printer._id.toString();
    setSettings((prev) => ({
      ...prev,
      printerSettings: {
        ...prev.printerSettings,
        defaultPrinterId: idString,
      },
    }));
    setSelectedPrinterId(printer.clientId || idString);
  };

  // Staff Management Functions
  const openStaffModal = (staff = null) => {
    if (staff) {
      setEditingStaff(staff);
      setStaffForm({
        name: staff.name || "",
        role: staff.role || "ofitsiant",
        pinCode: ""
      });
    } else {
      setEditingStaff(null);
      setStaffForm({
        name: "",
        role: "ofitsiant",
        pinCode: ""
      });
    }
    setShowStaffModal(true);
  };

  const closeStaffModal = () => {
    setShowStaffModal(false);
    setEditingStaff(null);
    setStaffForm({
      name: "",
      role: "ofitsiant",
      pinCode: ""
    });
  };

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      if (editingStaff) {
        // Update existing staff
        const staffId = editingStaff.id || editingStaff._id;
        await api.put(`/auth/staff/${staffId}`, staffForm);
        setSaveMessage("✅ Xodim muvaffaqiyatli yangilandi!");
      } else {
        // Create new staff
        await api.post("/auth/register", staffForm);
        setSaveMessage("✅ Xodim muvaffaqiyatli qo'shildi!");
      }
      
      fetchStaffList();
      closeStaffModal();
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      setSaveMessage("❌ Xato: " + (error.response?.data?.message || "Xodimni saqlab bo'lmadi"));
      setTimeout(() => setSaveMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = async (staffId, staffName) => {
    if (!window.confirm(`${staffName} xodimni o'chirmoqchimisiz?`)) return;
    
    try {
      setLoading(true);
      await api.delete(`/auth/staff/${staffId}`);
      setSaveMessage("✅ Xodim muvaffaqiyatli o'chirildi!");
      fetchStaffList();
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      setSaveMessage("❌ Xato: " + (error.response?.data?.message || "Xodimni o'chirib bo'lmadi"));
      setTimeout(() => setSaveMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "general", label: "Umumiy", icon: "🏪" },
    { id: "printer", label: "Printer", icon: "🖨️" },
    { id: "payment", label: "To'lov", icon: "💳" },
    { id: "tax", label: "Servis", icon: "📊" },
    { id: "taxIntegration", label: "Soliq Integratsiyasi", icon: "🧾" },
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

  const renderPrinterSettings = () => {
    const printerSettings = settings.printerSettings || BASE_PRINTER_SETTINGS;
    const printers = printerSettings.printers || [];
    const activePrinter = printers.find((printer) => {
      const id = printer.clientId || printer._id?.toString();
      return id === selectedPrinterId;
    }) || printers[0];

    const activePrinterId = activePrinter ? activePrinter.clientId || activePrinter._id?.toString() : "";
    const templateOverrides = activePrinter?.templateOverrides || {};
    const triggers = activePrinter?.autoPrintTriggers || [];
    const canRemovePrinter = printers.length > 1;

    return (
      <div className="settings-panel">
        <h2>🖨️ Printer Sozlamalar</h2>

        <div className="toggle-section">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={printerSettings.enabled || false}
              onChange={(e) => handleChange("printerSettings", "enabled", e.target.checked)}
            />
            <span className="toggle-switch"></span>
            <span>Printerni Faollashtirish</span>
          </label>

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={printerSettings.autoprint || false}
              onChange={(e) => handleChange("printerSettings", "autoprint", e.target.checked)}
            />
            <span className="toggle-switch"></span>
            <span>To'lovdan so'ng avtomatik chek ochish</span>
          </label>

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={printerSettings.printLogo || false}
              onChange={(e) => handleChange("printerSettings", "printLogo", e.target.checked)}
            />
            <span className="toggle-switch"></span>
            <span>Logotipni Ko'rsatish</span>
          </label>

          <label className="toggle-label">
            <input
              type="checkbox"
              checked={printerSettings.printPaymentMethod || false}
              onChange={(e) => handleChange("printerSettings", "printPaymentMethod", e.target.checked)}
            />
            <span className="toggle-switch"></span>
            <span>To'lov turini chiqarish</span>
          </label>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Umumiy chek sarlavhasi</label>
            <input
              type="text"
              value={printerSettings.headerText || ""}
              onChange={(e) => handleChange("printerSettings", "headerText", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Umumiy pastki matn</label>
            <input
              type="text"
              value={printerSettings.footerText || ""}
              onChange={(e) => handleChange("printerSettings", "footerText", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Bo'luvchi belgisi</label>
            <input
              type="text"
              maxLength={1}
              value={printerSettings.receiptTemplate?.accentSymbol || "-"}
              onChange={(e) => handleReceiptTemplateChange("accentSymbol", (e.target.value || "-").slice(0, 1))}
            />
          </div>

          <div className="form-group full-width">
            <label>Umumiy chek xabari</label>
            <input
              type="text"
              value={printerSettings.receiptTemplate?.customMessage || ""}
              onChange={(e) => handleReceiptTemplateChange("customMessage", e.target.value)}
              placeholder="Masalan: Har kuni 10:00-12:00 oralig'ida 10% chegirma"
            />
          </div>
        </div>

        {printerSettings.enabled ? (
          printers.length ? (
            <div className="printer-settings-layout">
              <aside className="printer-list">
                {printers.map((printer) => {
                  const id = printer.clientId || printer._id?.toString();
                  const isActive = id === activePrinterId;
                  const isDefault =
                    printer._id && printerSettings.defaultPrinterId && printer._id.toString() === printerSettings.defaultPrinterId;

                  return (
                    <button
                      key={id}
                      type="button"
                      className={`printer-card${isActive ? " active" : ""}`}
                      onClick={() => handleSelectPrinter(id)}
                    >
                      <div className="printer-card-head">
                        <span className="printer-card-name">{printer.name}</span>
                        <span className={`printer-status-dot status-${printer.connectionStatus || "disconnected"}`}></span>
                      </div>
                      <div className="printer-card-meta">
                        <span>{printer.role === "front" ? "Oldingi zal" : printer.role === "kitchen" ? "Oshxona" : printer.role === "bar" ? "Bar" : printer.role === "delivery" ? "Dostavka" : "Custom"}</span>
                        <span>{printer.connectionType === "network" ? printer.ipAddress || "IP aniqlanmagan" : printer.connectionType.toUpperCase()}</span>
                      </div>
                      {isDefault && <span className="printer-badge">Default</span>}
                    </button>
                  );
                })}

                <button type="button" className="printer-card add" onClick={handleAddPrinter}>
                  <span className="add-icon">+</span>
                  <span>Printer qo'shish</span>
                </button>
              </aside>

              {activePrinter ? (
                <div className="printer-detail">
                  <div className="printer-detail-header">
                    <div>
                      <h3>{activePrinter.name}</h3>
                      <p className="printer-detail-sub">
                        {activePrinter.connectionType === "network"
                          ? `${activePrinter.ipAddress || "IP belgilanmagan"}:${activePrinter.port}`
                          : activePrinter.connectionType.toUpperCase()}
                      </p>
                    </div>
                    <div className="printer-detail-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={!activePrinter._id}
                        onClick={() => handleSetDefaultPrinter(activePrinter)}
                      >
                        Default qilish
                      </button>
                      {canRemovePrinter && (
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => handleRemovePrinter(activePrinterId)}
                        >
                          O'chirish
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Printer nomi</label>
                      <input
                        type="text"
                        value={activePrinter.name || ""}
                        onChange={(e) => handlePrinterFieldChange(activePrinterId, "name", e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Vazifa</label>
                      <select
                        value={activePrinter.role || "front"}
                        onChange={(e) => handlePrinterFieldChange(activePrinterId, "role", e.target.value)}
                      >
                        <option value="front">Oldingi zal</option>
                        <option value="kitchen">Oshxona</option>
                        <option value="bar">Bar</option>
                        <option value="delivery">Dostavka</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Joylashuv</label>
                      <input
                        type="text"
                        value={activePrinter.location || ""}
                        onChange={(e) => handlePrinterFieldChange(activePrinterId, "location", e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Ulanish turi</label>
                      <select
                        value={activePrinter.connectionType || "network"}
                        onChange={(e) => handlePrinterFieldChange(activePrinterId, "connectionType", e.target.value)}
                      >
                        <option value="network">Network (IP)</option>
                        <option value="usb">USB</option>
                        <option value="bluetooth">Bluetooth</option>
                      </select>
                    </div>

                    {activePrinter.connectionType === "network" && (
                      <>
                        <div className="form-group">
                          <label>IP manzil</label>
                          <input
                            type="text"
                            value={activePrinter.ipAddress || ""}
                            onChange={(e) => handlePrinterFieldChange(activePrinterId, "ipAddress", e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Port</label>
                          <input
                            type="number"
                            value={activePrinter.port || 9100}
                            onChange={(e) => handlePrinterFieldChange(activePrinterId, "port", parseInt(e.target.value, 10) || 9100)}
                          />
                        </div>
                      </>
                    )}

                    <div className="form-group">
                      <label>Qog'oz kengligi</label>
                      <select
                        value={activePrinter.paperWidth || "80mm"}
                        onChange={(e) => handlePrinterFieldChange(activePrinterId, "paperWidth", e.target.value)}
                      >
                        <option value="58mm">58mm</option>
                        <option value="80mm">80mm</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Printer turi</label>
                      <select
                        value={activePrinter.printerType || "thermal"}
                        onChange={(e) => handlePrinterFieldChange(activePrinterId, "printerType", e.target.value)}
                      >
                        <option value="thermal">Thermal</option>
                        <option value="inkjet">Inkjet</option>
                        <option value="laser">Laser</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Nusxalar soni</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={activePrinter.copies || 1}
                        onChange={(e) => handlePrinterFieldChange(activePrinterId, "copies", parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>Chek sarlavhasi (override)</label>
                      <input
                        type="text"
                        value={activePrinter.headerText || ""}
                        onChange={(e) => handlePrinterFieldChange(activePrinterId, "headerText", e.target.value)}
                        placeholder={printerSettings.headerText}
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>Chek pastki matni (override)</label>
                      <input
                        type="text"
                        value={activePrinter.footerText || ""}
                        onChange={(e) => handlePrinterFieldChange(activePrinterId, "footerText", e.target.value)}
                        placeholder={printerSettings.footerText}
                      />
                    </div>

                    <div className="form-group full-width">
                      <label>Chek qo'shimcha xabari</label>
                      <textarea
                        rows={3}
                        value={templateOverrides.customMessage || ""}
                        onChange={(e) => handleTemplateOverrideChange(activePrinterId, "customMessage", e.target.value)}
                        placeholder="Masalan: Har kuni 10:00-12:00 oralig'ida 10% chegirma!"
                      />
                    </div>
                  </div>

                  <div className="toggle-section">
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={activePrinter.enabled !== false}
                        onChange={(e) => handlePrinterFieldChange(activePrinterId, "enabled", e.target.checked)}
                      />
                      <span className="toggle-switch"></span>
                      <span>Printer faol</span>
                    </label>

                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={activePrinter.autoprint || false}
                        onChange={(e) => handlePrinterFieldChange(activePrinterId, "autoprint", e.target.checked)}
                      />
                      <span className="toggle-switch"></span>
                      <span>Avtomatik chop</span>
                    </label>

                    <div className="trigger-grid">
                      {PRINTER_TRIGGER_OPTIONS.map((option) => (
                        <label key={option.value} className="trigger-item">
                          <input
                            type="checkbox"
                            checked={triggers.includes(option.value)}
                            onChange={() => togglePrinterTrigger(activePrinterId, option.value)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Bo'luvchi uslubi</label>
                      <select
                        value={templateOverrides.dividerStyle || printerSettings.receiptTemplate?.dividerStyle || "dashed"}
                        onChange={(e) => handleTemplateOverrideChange(activePrinterId, "dividerStyle", e.target.value)}
                      >
                        <option value="dashed">Chiziqli</option>
                        <option value="solid">Qalin</option>
                        <option value="double">Ikki chiziq</option>
                        <option value="accent">Belgilangan</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Qalin jami</label>
                      <select
                        value={(templateOverrides.boldTotals ?? printerSettings.receiptTemplate?.boldTotals) ? "true" : "false"}
                        onChange={(e) => handleTemplateOverrideChange(activePrinterId, "boldTotals", e.target.value === "true")}
                      >
                        <option value="true">Ha</option>
                        <option value="false">Yo'q</option>
                      </select>
                    </div>
                  </div>

                  <div className="printer-status-grid">
                    <div>
                      <span className="printer-status-label">Oxirgi ulanish testi</span>
                      <strong>{formatDateTime(activePrinter.lastConnectionTest || printerSettings.lastConnectionTest)}</strong>
                    </div>
                    <div>
                      <span className="printer-status-label">Oxirgi test cheki</span>
                      <strong>{formatDateTime(activePrinter.lastTestPrintDate || printerSettings.lastTestPrintDate)}</strong>
                    </div>
                    <div>
                      <span className="printer-status-label">Oxirgi real chop</span>
                      <strong>{formatDateTime(activePrinter.lastPrintDate || printerSettings.lastPrintDate)}</strong>
                    </div>
                  </div>

                  {activePrinter.lastPrintError && (
                    <div className="printer-error">
                      ❗ {activePrinter.lastPrintError}
                    </div>
                  )}

                  <div className="button-group">
                    <button
                      type="button"
                      className="btn-test"
                      onClick={testPrinterConnection}
                      disabled={testingConnection}
                    >
                      {testingConnection ? "Tekshirilmoqda..." : "🔌 Ulanishni tekshirish"}
                    </button>

                    <button
                      type="button"
                      className="btn-test"
                      onClick={testPrintCheck}
                      disabled={testingPrint}
                    >
                      {testingPrint ? "Chop qilinyapti..." : "🖨️ Test chek"}
                    </button>

                    <button
                      type="button"
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
                      Lokal agent yoqilmagan bo'lsa, tugma backend orqali ulanadi. Agar agent boshqa qurilmada ishga tushgan bo'lsa, kanal nomi mos bo'lishi kifoya.
                    </p>
                  )}
                </div>
              ) : (
                <div className="printer-detail empty">
                  <p>Printer tanlanmagan.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="printer-empty-state">
              <p>Hali printer qo'shilmagan.</p>
              <button type="button" className="btn-secondary" onClick={handleAddPrinter}>
                Printer qo'shish
              </button>
            </div>
          )
        ) : null}
      </div>
    );
  };

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
      <h2>📊 Servis Haqi Sozlamalari</h2>

      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.tax?.serviceChargeEnabled || false}
            onChange={(e) => handleServiceToggle(e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Servis haqini faollashtirish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.tax?.includeInPrice || false}
            onChange={(e) => handleChange("tax", "includeInPrice", e.target.checked)}
            disabled={!settings.tax?.serviceChargeEnabled}
          />
          <span className="toggle-switch"></span>
          <span>Narxga kiritish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.tax?.showOnReceipt !== false}
            onChange={(e) => handleChange("tax", "showOnReceipt", e.target.checked)}
            disabled={!settings.tax?.serviceChargeEnabled}
          />
          <span className="toggle-switch"></span>
          <span>Chekda ko'rsatish</span>
        </label>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Servis nomi</label>
          <input
            type="text"
            placeholder="Servis haqi"
            value={settings.tax?.taxName || ""}
            onChange={(e) => handleChange("tax", "taxName", e.target.value)}
            disabled={!settings.tax?.serviceChargeEnabled}
          />
        </div>

        <div className="form-group">
          <label>Servis foizi (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={
              settings.tax?.serviceCharge !== undefined
                ? settings.tax.serviceCharge
                : settings.tax?.taxRate || 0
            }
            onChange={(e) => {
              const parsed = parseFloat(e.target.value);
              handleServiceRateChange(Number.isNaN(parsed) ? 0 : parsed);
            }}
            disabled={!settings.tax?.serviceChargeEnabled}
          />
        </div>
      </div>
    </div>
  );

  const renderTaxIntegrationSettings = () => (
    <div className="settings-panel">
      <h2>🧾 Soliq Integratsiyasi</h2>

      <div className="toggle-section">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.taxIntegration?.enabled || false}
            onChange={(e) => handleChange("taxIntegration", "enabled", e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span>Integratsiyani Faollashtirish</span>
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={settings.taxIntegration?.autoFiscalize !== false}
            onChange={(e) => handleChange("taxIntegration", "autoFiscalize", e.target.checked)}
            disabled={!settings.taxIntegration?.enabled}
          />
          <span className="toggle-switch"></span>
          <span>Buyurtmalarni Avto Fiskallashtirish</span>
        </label>
      </div>

      {settings.taxIntegration?.enabled && (
        <>
          <div className="form-grid">
            <div className="form-group">
              <label>Provayder</label>
              <select
                value={settings.taxIntegration?.provider || "iiko"}
                onChange={(e) => handleChange("taxIntegration", "provider", e.target.value)}
              >
                <option value="iiko">iiko</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="form-group">
              <label>Rejim</label>
              <select
                value={settings.taxIntegration?.mode || "sandbox"}
                onChange={(e) => handleChange("taxIntegration", "mode", e.target.value)}
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </div>

            <div className="form-group">
              <label>API URL</label>
              <input
                type="text"
                value={settings.taxIntegration?.apiBaseUrl || ""}
                onChange={(e) => handleChange("taxIntegration", "apiBaseUrl", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Login (Client ID)</label>
              <input
                type="text"
                value={settings.taxIntegration?.apiLogin || ""}
                onChange={(e) => handleChange("taxIntegration", "apiLogin", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>API Key / Secret</label>
              <input
                type="password"
                value={settings.taxIntegration?.apiKey || ""}
                onChange={(e) => handleChange("taxIntegration", "apiKey", e.target.value)}
                placeholder={settings.taxIntegration?.mode === "sandbox" ? "Sandbox rejimi API key talab qilmaydi" : "API kalitini kiriting"}
              />
            </div>

            <div className="form-group">
              <label>Tashkilot ID</label>
              <input
                type="text"
                value={settings.taxIntegration?.organizationId || ""}
                onChange={(e) => handleChange("taxIntegration", "organizationId", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Standart QQS (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.taxIntegration?.defaultVatRate || 12}
                onChange={(e) => handleChange("taxIntegration", "defaultVatRate", parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="button-group">
            <button
              type="button"
              className="btn-test"
              onClick={testTaxIntegrationConnection}
              disabled={testingTaxIntegration}
            >
              {testingTaxIntegration ? "Tekshirilmoqda..." : "🧪 Integratsiyani Tekshirish"}
            </button>
          </div>
        </>
      )}
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
      
      {/* Staff Management Section */}
      <div className="staff-management-section">
        <div className="section-header">
          <h3>Xodimlar Ro'yxati</h3>
          <button className="btn-add-staff" onClick={() => openStaffModal()}>
            ➕ Yangi Xodim Qo'shish
          </button>
        </div>

        <div className="staff-table-container">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Ism</th>
                <th>Lavozim</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {!Array.isArray(staffList) || staffList.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>
                    Xodimlar mavjud emas
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id || staff._id}>
                    <td>{staff.name}</td>
                    <td>
                      <span className={`role-badge role-${staff.role}`}>
                        {staff.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="btn-edit"
                          onClick={() => openStaffModal(staff)}
                          title="Tahrirlash"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() => handleDeleteStaff(staff.id || staff._id, staff.name)}
                          title="O'chirish"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <hr className="settings-divider" />

      {/* General Staff Settings */}
      <h3>Umumiy Xodim Sozlamalari</h3>
      
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
      case "taxIntegration":
        return renderTaxIntegrationSettings();
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

  return (
    <div className="page-shell settings-shell">
      <header className="page-header settings-header">
        <div>
          <p className="tagline">Konfiguratsiya</p>
          <h1 className="page-title">Tizim sozlamalari</h1>
          <p className="page-subtitle">POS operatsiyalari va xizmatlar uchun markaziy boshqaruv</p>
        </div>
        {saveMessage && (
          <div className={`settings-alert alert alert--${saveMessageTone}`}>
            {saveMessage}
          </div>
        )}
      </header>

      <div className="settings-body">
        <aside className="settings-sidebar glass-panel">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </aside>

        <section className="settings-content glass-panel">
          {loading && (
            <div className="settings-loading">
              <span className="settings-loading-spinner" />
              <span>Yuklanmoqda...</span>
            </div>
          )}
          <div className="settings-content-scroll">
            {renderContent()}
          </div>
        </section>
      </div>

      <footer className="settings-footer glass-panel">
        <button className="btn-primary" onClick={saveSettings} disabled={loading}>
          {loading ? "Saqlanmoqda..." : "Sozlamalarni saqlash"}
        </button>
      </footer>

      {showStaffModal && (
        <div className="settings-modal-overlay" onClick={closeStaffModal}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h2>{editingStaff ? "Xodimni tahrirlash" : "Yangi xodim qo'shish"}</h2>
              <button className="settings-modal-close" onClick={closeStaffModal}>✕</button>
            </div>

            <form onSubmit={handleStaffSubmit}>
              <div className="settings-modal-body">
                <div className="form-group">
                  <label>To'liq ism *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ism Familiya"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>PIN kod (4-6 raqam) {editingStaff ? "(o'zgarmasa bo'sh qoldiring)" : "*"}</label>
                  <input
                    type="text"
                    required={!editingStaff}
                    maxLength="6"
                    minLength="4"
                    placeholder="1234"
                    value={staffForm.pinCode}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, pinCode: e.target.value.replace(/\D/g, "") })
                    }
                  />
                  <small className="settings-modal-hint">
                    Xodim tizimga ushbu PIN orqali kiradi
                  </small>
                </div>

                <div className="form-group">
                  <label>Lavozim *</label>
                  <select
                    required
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  >
                    <option value="admin">👑 Admin</option>
                    <option value="kassir">💰 Kassir</option>
                    <option value="ofitsiant">🍽️ Ofitsiant</option>
                    <option value="oshpaz">👨‍🍳 Oshpaz</option>
                  </select>
                </div>

                {!editingStaff && (
                  <div className="settings-info-banner">
                    ℹ️ <strong>Eslatma:</strong> username va parol avtomatik yaratiladi, xodim PIN orqali kiradi.
                  </div>
                )}
              </div>

              <div className="settings-modal-footer">
                <button type="button" className="btn-ghost" onClick={closeStaffModal}>
                  Bekor qilish
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Saqlanmoqda..." : editingStaff ? "Saqlash" : "Qo'shish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
