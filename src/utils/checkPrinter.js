// src/frontend/src/utils/checkPrinter.js
// Chek printerlash uchun utility
// Printer sozlamalaridan foydalanadi

export const generateCheckHTML = (order, payment, printerSettings = {}) => {
  const now = new Date();
  const date = now.toLocaleDateString("uz-UZ");
  const time = now.toLocaleTimeString("uz-UZ");

  // Printer sozlamalarini olish
  const {
    paperWidth = "80mm",
    printLogo = true,
    printRestaurantName = true,
    printTableNumber = true,
    printWaiterName = true,
    printTimestamp = true,
    printPaymentMethod = true,
    headerText = "ZarPOS Restoran",
    footerText = "Raxmat, qayta ko'ring!"
  } = printerSettings;

  // Qog'oz kengligiga qarab max-width o'zlashtirish
  const maxWidth = paperWidth === "58mm" ? "240px" : "320px";

  // Items ni to'g'ri formatla
  const items = (order.items || [])
    .map(
      (item) => `
    <div style="display: flex; justify-content: space-between; border-bottom: 1px dotted #000; padding: 5px 0; font-size: 14px;">
      <span>${item.qty}x ${item.name}</span>
      <span>${(item.price * item.qty).toLocaleString()} so'm</span>
    </div>
  `
    )
    .join("");

  // Payment methods ni to'g'ri format qil
  const paymentMethods =
    payment && payment.parts && payment.parts.length > 0
      ? payment.parts
          .map((p) => `<div style="font-size: 13px;">${p.method}: ${p.amount.toLocaleString()} so'm</div>`)
          .join("")
      : payment && payment.method
      ? `<div style="font-size: 13px;">${payment.method}: ${(payment.amount || 0).toLocaleString()} so'm</div>`
      : "";

  // Tax va discount hisoblash
  const subtotal = order.subtotal || order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = order.tax || Math.round(subtotal * 0.12);
  const discount = order.discount || 0;
  const total = order.total || subtotal + tax - discount;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Chek ${order.tableName || "Dostavka"}</title>
      <style>
        body { 
          font-family: 'Courier New', monospace; 
          max-width: ${maxWidth}; 
          margin: 0; 
          padding: 10px;
          background: white;
        }
        .header { 
          text-align: center; 
          font-weight: bold; 
          font-size: 16px;
          margin-bottom: 10px; 
        }
        .restaurant-name {
          text-align: center;
          font-size: 14px;
          margin-bottom: 10px;
          font-weight: 600;
        }
        .divider { 
          border-bottom: 2px dashed #000; 
          margin: 8px 0; 
        }
        .total { 
          font-size: 18px; 
          font-weight: bold; 
          text-align: right;
          padding: 10px 0;
        }
        .payment-methods { 
          margin: 10px 0;
          font-size: 13px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin: 3px 0;
        }
        .footer {
          text-align: center;
          font-size: 12px;
          margin-top: 20px;
          color: #666;
        }
      </style>
    </head>
    <body>
      ${printLogo ? '<div class="header">⭐ CHEK ⭐</div>' : ''}
      ${printRestaurantName ? `<div class="restaurant-name">${headerText}</div>` : ''}
      <div class="divider"></div>
      
      <div>
        ${printTableNumber ? `<div class="info-row">
          <span>Stol/Buyurtma:</span>
          <span><strong>${order.tableName || "Dostavka"}</strong></span>
        </div>` : ''}
        ${printWaiterName && order.waiterName ? `<div class="info-row">
          <span>Xizmatchi:</span>
          <span>${order.waiterName}</span>
        </div>` : ''}
        ${printTimestamp ? `<div class="info-row">
          <span>Sana:</span>
          <span>${date}</span>
        </div>
        <div class="info-row">
          <span>Vaqt:</span>
          <span>${time}</span>
        </div>` : ''}
      </div>
      
      <div class="divider"></div>
      
      <div>
        ${items || "<div style='color: #999; text-align: center;'>Mahsulotlar yo'q</div>"}
      </div>
      
      <div class="divider"></div>
      
      <div>
        <div class="info-row">
          <span>Subtotal:</span>
          <span>${subtotal.toLocaleString()} so'm</span>
        </div>
        <div class="info-row">
          <span>Servis:</span>
          <span>${tax.toLocaleString()} so'm</span>
        </div>
        ${discount > 0
          ? `
        <div class="info-row" style="color: green;">
          <span>Chegirma:</span>
          <span>-${discount.toLocaleString()} so'm</span>
        </div>
        `
          : ""}
      </div>
      
      <div class="divider"></div>
      
      <div class="total">
        JAMI: ${total.toLocaleString()} so'm
      </div>
      
      ${printPaymentMethod && paymentMethods
        ? `
      <div class="divider"></div>
      <div class="payment-methods">
        <strong>To'lov usuli:</strong>
        ${paymentMethods}
      </div>
      `
        : ""}
      
      <div class="divider"></div>
      
      <div class="footer">
        <strong>${footerText}</strong><br>
        ✓ ${new Date().toLocaleTimeString("uz-UZ")}
      </div>
    </body>
    </html>
  `;
};

export const printCheck = (order, payment, printerSettings = {}) => {
  const html = generateCheckHTML(order, payment, printerSettings);
  const printWindow = window.open("", "_blank", "width=400,height=600");
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 250);
};

export const downloadCheckAsHTML = (order, payment, printerSettings = {}) => {
  const html = generateCheckHTML(order, payment, printerSettings);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chek-${order.tableName || "dostavka"}-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadCheckAsPDF = async (order, payment, printerSettings = {}) => {
  // PDF download uchun html2pdf library kerak bo'ladi
  // Ushbu funksiya soddalashtirilgan version
  const html = generateCheckHTML(order, payment, printerSettings);
  const element = document.createElement("div");
  element.innerHTML = html;
  
  // Browser print to PDF
  const printWindow = window.open("", "_blank");
  printWindow.document.write(html);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 250);
};
