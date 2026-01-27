// ============================================================
// receipt.js
// ============================================================
// Purpose
// - Renders a donation receipt in receipt.html.
// - Provides an explicit Print button (important for iPad Safari).
// - Optionally auto-prints on desktop when ?autoprint=1.
//
// Data source
// - Expects an id in the URL: receipt.html?id=...&autoprint=1
// - Reads localStorage[`receipt:${id}`] (written by index.js or donations-management.js)
// - Falls back to sessionStorage['receipt:last'] for refreshes
// ============================================================

function isIOSDevice() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua);
}

function toFixed2(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

function renderReceipt(donation) {
  const root = document.getElementById('receiptRoot');

  if (!donation) {
    root.innerHTML = '<p style="color:#b00020;">Receipt data not found.</p>';
    return;
  }

  const dateTime = donation.dateTime || '';
  const companyName = donation.companyName || '';

  root.innerHTML = `
    <img src="images/HCFP-Logo-Edited-removebg-preview.png" class="logo" alt="HCFP Logo">
    <h1>Donation Receipt</h1>
    <div class="subtitle">Hancock County Food Pantry</div>

    <table class="info-table">
      <tr><td><strong>Date & Time:</strong></td><td>${dateTime}</td></tr>
      <tr><td><strong>Company Name:</strong></td><td>${companyName}</td></tr>
    </table>

    <table class="donation-table">
      <tr><th>Category</th><th>Weight (lbs)</th></tr>
      <tr><td>Produce</td><td>${toFixed2(donation.Produce)}</td></tr>
      <tr><td>Frozen Meats</td><td>${toFixed2(donation['Frozen Meats'])}</td></tr>
      <tr><td>Misc Frozen</td><td>${toFixed2(donation['Misc Frozen'])}</td></tr>
      <tr><td>Bakery</td><td>${toFixed2(donation.Bakery)}</td></tr>
      <tr><td>Dry</td><td>${toFixed2(donation.Dry)}</td></tr>
    </table>

    <div class="footer">Thank you for your generous donation!</div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const printBtn = document.getElementById('printBtn');
  const closeBtn = document.getElementById('closeBtn');
  const hint = document.getElementById('hint');

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const autoPrint = params.get('autoprint') === '1';

  let donation = null;
  if (id) {
    try {
      const raw = localStorage.getItem(`receipt:${id}`);
      if (raw) {
        donation = JSON.parse(raw);
        // Keep a copy for refresh within this tab, then remove the keyed item.
        sessionStorage.setItem('receipt:last', raw);
        localStorage.removeItem(`receipt:${id}`);
      }
    } catch {
      donation = null;
    }
  }

  if (!donation) {
    try {
      const raw = sessionStorage.getItem('receipt:last');
      donation = raw ? JSON.parse(raw) : null;
    } catch {
      donation = null;
    }
  }

  renderReceipt(donation);

  if (isIOSDevice()) {
    hint.textContent = 'On iPad/iPhone, tap Print to open the print dialog.';
  } else {
    hint.textContent = autoPrint ? 'Opening print dialog…' : '';
  }

  printBtn.addEventListener('click', () => {
    try { window.focus(); } catch { }
    try { window.print(); } catch { }
  });

  closeBtn.addEventListener('click', () => {
    try { window.close(); } catch { }
  });

  // Auto-print for desktop browsers if requested.
  if (autoPrint && !isIOSDevice()) {
    setTimeout(() => {
      try { window.focus(); } catch { }
      try { window.print(); } catch { }
    }, 250);
  }

  // After printing, try to close (desktop popups). iOS will usually ignore this.
  window.addEventListener('afterprint', () => {
    try { window.close(); } catch { }
  });
});
