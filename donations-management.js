// ============================================================
// donations-management.js
// ============================================================
// Purpose
// - Renders the donation history table on donations-management.html.
// - Allows sorting by date (toggle ascending/descending).
// - Allows deletion of a donation entry.
//
// Data source
// - localStorage('donationsList'): array of donation objects created on Home.
// ============================================================

function initNavbarMenu() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    const toggleButton = navbar.querySelector('.nav-toggle');
    const navLinks = navbar.querySelector('.nav-links');
    if (!toggleButton || !navLinks) return;

    function setOpen(isOpen) {
        navbar.classList.toggle('nav-open', isOpen);
        toggleButton.setAttribute('aria-expanded', String(isOpen));
    }

    toggleButton.addEventListener('click', function () {
        setOpen(!navbar.classList.contains('nav-open'));
    });

    navLinks.addEventListener('click', function (event) {
        const target = event.target;
        if (target && target.matches && target.matches('a')) {
            setOpen(false);
        }
    });

    window.addEventListener('resize', function () {
        if (window.innerWidth > 768) setOpen(false);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initNavbarMenu();

    // DOM anchors (only exist on donations-management.html)
    const tableBody = document.querySelector('#donationsTable tbody');
    const orderToggleBtn = document.getElementById('orderToggleBtn');

    // Controls the sort order in the UI
    let isDescending = true;

    function toFixed2(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num.toFixed(2) : '0.00';
    }

    function openReceiptPage(donation, { autoPrint = true } = {}) {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        try {
            localStorage.setItem(`receipt:${id}`, JSON.stringify(donation));
        } catch {
            alert('Unable to prepare receipt data (storage unavailable).');
            return;
        }

        const url = `receipt.html?id=${encodeURIComponent(id)}${autoPrint ? '&autoprint=1' : ''}`;
        const win = window.open(url, '_blank');
        if (!win) {
            alert('Popup blocked. Please allow popups to print receipts.');
            return;
        }
        try { win.focus(); } catch { }
    }

    function getSortedDonations() {
        const donations = JSON.parse(localStorage.getItem('donationsList') || '[]');
        donations.sort((a, b) => {
            let dateA = new Date(a.dateTime);
            let dateB = new Date(b.dateTime);
            if (isDescending) {
                return dateB - dateA;
            } else {
                return dateA - dateB;
            }
        });
        return donations;
    }

    function loadDonations() {
        // Full re-render of the table from storage
        tableBody.innerHTML = '';
        const donations = getSortedDonations();
        donations.forEach((donation, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${donation.dateTime}</td>
                <td>${donation.companyName}</td>
                <td>${toFixed2(donation.Produce)}</td>
                <td>${toFixed2(donation['Frozen Meats'])}</td>
                <td>${donation.temperature ? donation.temperature : ''}</td>
                <td>${toFixed2(donation['Misc Frozen'])}</td>
                <td>${toFixed2(donation.Bakery)}</td>
                <td>${toFixed2(donation.Dry)}</td>
                <td>
                    <div class="actions">
                        <button data-idx="${idx}" class="receipt-btn">Receipt</button>
                        <button data-idx="${idx}" class="delete-btn">Delete</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    if (orderToggleBtn) {
        orderToggleBtn.addEventListener('click', function() {
            // Toggle sort direction and re-render
            isDescending = !isDescending;
            orderToggleBtn.textContent = 'Order: ' + (isDescending ? 'Descending' : 'Ascending');
            loadDonations();
        });
    }

    // Add New Donation is a plain <a href="index.html"> link for maximum iOS Safari reliability.

    tableBody.addEventListener('click', function(e) {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;

        if (target.classList.contains('receipt-btn')) {
            const idx = parseInt(target.getAttribute('data-idx'));
            const donations = getSortedDonations();
            const donation = donations[idx];
            if (!donation) return;
            openReceiptPage(donation, { autoPrint: true });
            return;
        }

        if (target.classList.contains('delete-btn')) {
            const idx = parseInt(target.getAttribute('data-idx'));
            if (!confirm('Are you sure you want to delete this donation?')) return;
            const donations = getSortedDonations();
            donations.splice(idx, 1);
            localStorage.setItem('donationsList', JSON.stringify(donations));
            loadDonations();
        }
    });

    // Initial render
    loadDonations();
});
