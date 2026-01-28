// ============================================================
// index.js
// ============================================================
// Home page logic (index.html)
//
// Quick navigation
// - Donation submit / receipt: handleSubmitDonation()
// - Company dropdown sync:     updateCompanyDropdown()
// - Add-new-donor UI:          applyNewDonor(), handleCompanyChange()
// - Category + weight logging: selectCategory(), logWeight(), totals
// - Startup wiring:            DOMContentLoaded handler at bottom
// ============================================================

// =============================
// DONATION SUBMIT LOGIC
// =============================
function openReceiptPage(donation, { autoPrint = true } = {}) {
    // Writes the donation into localStorage under a short-lived key and opens receipt.html.
    // This is more reliable on iPad than trying to auto-print from injected HTML.
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
        localStorage.setItem(`receipt:${id}`, JSON.stringify(donation));
    } catch {
        // If storage is full/blocked, fall back to alert.
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

function handleSubmitDonation() {
    const companySelect = document.getElementById('companySelect');
    let companyName = companySelect ? companySelect.value : '';
    if (!companyName) {
        alert('Please select a donor (company) before submitting.');
        try { companySelect?.focus(); } catch { }
        return;
    }

    // If user chose "Add New Donor...", require them to actually add/select a donor first.
    if (String(companyName).toLowerCase() === 'new') {
        const newDonorInput = document.getElementById('newDonorInput');
        const typed = String(newDonorInput?.value || '').trim();
        if (typed) {
            // Try to add and select it, then continue.
            applyNewDonor();
            companyName = companySelect ? companySelect.value : '';
        }

        if (!companyName || String(companyName).toLowerCase() === 'new') {
            alert('Please add a new donor name and tap Add before submitting.');
            try { newDonorInput?.focus(); } catch { }
            return;
        }
    }
    // Get totals
    // Temperature: required when Frozen Meats is part of this donation.
    let temperature = '';
    if ((categoryTotals['Frozen Meats'] || 0) > 0) {
        const tempInput = document.getElementById('temperatureInput');
        if (tempInput) tempInput.classList.add('show');

        const tempValue = String(tempInput?.value || '').trim();
        if (!tempValue) {
            alert('Please enter a temperature for Frozen Meats.');
            try { tempInput?.focus(); } catch { }
            return;
        }

        temperature = tempValue;
    }
    const donation = {
        dateTime: new Date().toLocaleString(),
        companyName,
        Produce: categoryTotals['Produce'] || 0,
        'Frozen Meats': categoryTotals['Frozen Meats'] || 0,
        'Misc Frozen': categoryTotals['Misc Frozen'] || 0,
        Bakery: categoryTotals['Bakery'] || 0,
        Dry: categoryTotals['Dry'] || 0,
        temperature
    };
    if (!confirm('Would you like to finalize this donation?')) return;
    // Store donation
    let donations = JSON.parse(localStorage.getItem('donationsList') || '[]');
    donations.push(donation);
    localStorage.setItem('donationsList', JSON.stringify(donations));
    if (confirm('Would you like to print a receipt?')) {
                openReceiptPage(donation, { autoPrint: true });
    }
    // Redirect to Donations Management page
    window.location.href = 'donations-management.html';
}
// =============================
// DONOR DROPDOWN SYNC
// =============================
function updateCompanyDropdown() {
    // Populates the "Select Company" dropdown from localStorage('donorList').
    //
    // Notes:
    // - We preserve the placeholder option at index 0.
    // - We optionally preserve an "Add New" option for older UIs.
    // - We support legacy donor storage format (array of { name }).
    const companySelect = document.getElementById('companySelect');
    if (!companySelect) return;
    // Save current selection
    const current = companySelect.value;

    // Ensure placeholder exists at index 0
    if (companySelect.options.length === 0) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.text = '-- Select a Company --';
        companySelect.add(placeholder);
    }
    const placeholderOption = companySelect.options[0];

    // Detect (or create) the "Add New Donor" option.
    // Requirement: it must always be at the top of the donor list (index 1).
    let addNewOption = [...companySelect.options].find(opt =>
        (opt.value || '').toLowerCase() === 'new' ||
        (opt.text || '').toLowerCase().includes('add new')
    ) || null;

    if (!addNewOption) {
        addNewOption = document.createElement('option');
        addNewOption.value = 'New';
        addNewOption.text = 'Add New Donor...';
        companySelect.add(addNewOption);
    }

    // Move "Add New Donor" to index 1 (right under placeholder) if needed.
    if (companySelect.options.length >= 2 && companySelect.options[1] !== addNewOption) {
        companySelect.remove(addNewOption.index);
        companySelect.add(addNewOption, 1);
    }

    // Clear all options except placeholder and optional addNewOption
    for (let i = companySelect.options.length - 1; i >= 0; i--) {
        const opt = companySelect.options[i];
        if (opt === placeholderOption) continue;
        if (addNewOption && opt === addNewOption) continue;
        companySelect.remove(i);
    }

    // Load donors from storage
    let donors = [];
    try {
        const raw = JSON.parse(localStorage.getItem('donorList')) || [];
        if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object' && raw[0] !== null) {
            // Legacy format: [{ name: "Acme" }, ...] -> ["Acme", ...]
            donors = raw
                .map(d => (typeof d?.name === 'string' ? d.name : ''))
                .filter(Boolean);
            localStorage.setItem('donorList', JSON.stringify(donors));
        } else {
            donors = Array.isArray(raw) ? raw : [];
        }
    } catch {
        donors = [];
    }
    // Favorites (stored as lowercased names)
    let favoriteSet = new Set();
    try {
        const favRaw = JSON.parse(localStorage.getItem('donorFavorites') || '[]');
        if (Array.isArray(favRaw)) {
            favoriteSet = new Set(favRaw.map(s => String(s || '').trim().toLowerCase()).filter(Boolean));
        }
    } catch {
        favoriteSet = new Set();
    }

    // Get sortMode from localStorage (default to 'date-desc')
    let sortMode = localStorage.getItem('donorSortMode') || 'date-desc';
    if (sortMode === 'date-desc') {
        donors = donors.slice().reverse();
    } else if (sortMode === 'date-asc') {
        donors = donors.slice();
    } else if (sortMode === 'alpha-asc') {
        donors = donors.slice().sort((a, b) => a.localeCompare(b));
    } else if (sortMode === 'alpha-desc') {
        donors = donors.slice().sort((a, b) => b.localeCompare(a));
    }
    // Pin favorites to the top, preserving the chosen sort order within each group
    const favorites = [];
    const nonFavorites = [];
    donors.forEach(name => {
        const key = String(name || '').trim().toLowerCase();
        if (favoriteSet.has(key)) favorites.push(name);
        else nonFavorites.push(name);
    });

    [...favorites, ...nonFavorites].forEach(name => {
        const normalized = String(name || '').trim();
        if (!normalized) return;

        // Don't add if already present (shouldn't happen)
        if ([...companySelect.options].some(opt => String(opt.value || '').toLowerCase() === normalized.toLowerCase())) return;

        const isFav = favoriteSet.has(normalized.toLowerCase());
        const opt = document.createElement('option');
        opt.value = normalized;
        opt.text = isFav ? `★ ${normalized}` : normalized;

        // Append donors after placeholder + "Add New Donor"
        companySelect.add(opt);
    });

    // Restore selection if possible
    if ([...companySelect.options].some(o => o.value === current)) {
        companySelect.value = current;
    } else {
        companySelect.value = '';
    }

    // Ensure the inline add-donor UI matches the current selection.
    if (typeof handleCompanyChange === 'function') {
        handleCompanyChange();
    }
}
// =============================
// ADD NEW DONOR LOGIC
// =============================
function applyNewDonor() {
    // Adds a new donor directly from the Home page UI (if present).
    const newDonorInput = document.getElementById('newDonorInput');
    const companySelect = document.getElementById('companySelect');
    if (!newDonorInput || !companySelect) return;
    const newDonor = newDonorInput.value.trim();
    if (!newDonor) {
        alert('Please enter a donor name.');
        return;
    }

    // Load donors from storage (and normalize legacy formats)
    let donors = [];
    try {
        const raw = JSON.parse(localStorage.getItem('donorList')) || [];
        if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object' && raw[0] !== null) {
            donors = raw
                .map(d => (typeof d?.name === 'string' ? d.name : ''))
                .filter(Boolean);
        } else {
            donors = Array.isArray(raw) ? raw : [];
        }
    } catch {
        donors = [];
    }

    // Check for duplicates (case-insensitive)
    if (donors.some(d => String(d).toLowerCase() === newDonor.toLowerCase())) {
        alert('That donor already exists in the list.');
        companySelect.value = donors.find(d => String(d).toLowerCase() === newDonor.toLowerCase()) || '';
        newDonorInput.value = '';
        handleCompanyChange();
        return;
    }

    donors.push(newDonor);
    localStorage.setItem('donorList', JSON.stringify(donors));

    // Rebuild dropdown from storage (keeps ordering consistent with donor-management sort mode)
    updateCompanyDropdown();
    companySelect.value = newDonor;

    // Clear + hide the inline UI
    newDonorInput.value = '';
    handleCompanyChange();
}

// =============================
// STATE VARIABLES
// =============================
let selectedCategory = '';
const categoryTotals = {
    'Produce': 0,
    'Frozen Meats': 0,
    'Misc Frozen': 0,
    'Bakery': 0,
    'Dry': 0
};
let lastMeasurement = null;

// =============================
// ACTION FUNCTIONS
// =============================
function undoLastMeasurement() {
    if (!lastMeasurement) {
        alert('No measurement to undo.');
        return;
    }
    categoryTotals[lastMeasurement.category] -= lastMeasurement.weight;
    if (categoryTotals[lastMeasurement.category] < 0) categoryTotals[lastMeasurement.category] = 0;
    updateCategoryTotals();
    lastMeasurement = null;
}

function clearCategory() {
    if (!selectedCategory || !(selectedCategory in categoryTotals)) {
        alert('Please select a category to clear.');
        return;
    }
    categoryTotals[selectedCategory] = 0;
    updateCategoryTotals();
}

function restartDonation() {
    if (!confirm('Are you sure you want to restart the donation? This will clear all entered data.')) return;
    for (const cat in categoryTotals) {
        categoryTotals[cat] = 0;
    }
    updateCategoryTotals();
    lastMeasurement = null;
    // Reset UI fields
    document.getElementById('categoryLabel').textContent = 'Select Category';
    const usageValueElem = document.querySelector('.usage-value');
    if (usageValueElem) {
        if (usageValueElem.tagName === 'INPUT') {
            usageValueElem.value = '0.00';
        } else {
            usageValueElem.textContent = '0.00';
        }
    }
    // Optionally reset company and donor fields
    const companySelect = document.getElementById('companySelect');
    if (companySelect) companySelect.value = '';
    const newDonorInput = document.getElementById('newDonorInput');
    if (newDonorInput) newDonorInput.value = '';
    const addNewDonorSection = document.getElementById('addNewDonorSection');
    if (addNewDonorSection) addNewDonorSection.style.display = 'none';
}

function logWeight() {
    // Records a single weight entry into the selected category total.
    // Require a donor selection/add first (prevents weights being entered without a company).
    const companySelect = document.getElementById('companySelect');
    const companyName = companySelect ? companySelect.value : '';
    if (!companyName || String(companyName).toLowerCase() === 'new') {
        alert('Please select or add a donor (company) before logging weight.');
        try { companySelect?.focus(); } catch { }
        return;
    }

    const category = selectedCategory;
    if (!category || !(category in categoryTotals)) {
        alert('Please select a category.');
        return;
    }

    // If Frozen Meats is selected, require a temperature before logging.
    if (category === 'Frozen Meats') {
        const tempInput = document.getElementById('temperatureInput');
        if (tempInput) tempInput.classList.add('show');
        const tempValue = String(tempInput?.value || '').trim();
        if (!tempValue) {
            alert('Please enter a temperature for Frozen Meats.');
            try { tempInput?.focus(); } catch { }
            return;
        }
    }
    // Get weight value
    const usageValueElem = document.querySelector('.usage-value');
    // Support both input and div for usage-value
    let weight = 0;
    if (usageValueElem.tagName === 'INPUT') {
        weight = parseFloat(usageValueElem.value);
    } else {
        weight = parseFloat(usageValueElem.textContent);
    }
    if (isNaN(weight) || weight <= 0) {
        alert('Please enter a valid weight.');
        return;
    }
    // Add to total
    categoryTotals[category] += weight;
    lastMeasurement = { category, weight };
    updateCategoryTotals();
    // Reset usage value for next entry
    if (usageValueElem.tagName === 'INPUT') {
        usageValueElem.value = '0.00';
    } else {
        usageValueElem.textContent = '0.00';
    }
}


// =============================
// UI UPDATE FUNCTIONS
// =============================
function updateCategoryTotals() {
    // Update output section
    const outputItems = document.querySelectorAll('.output-item');
    outputItems.forEach(item => {
        const label = item.querySelector('.output-label').textContent;
        if (label in categoryTotals) {
            item.querySelector('.output-value').textContent = categoryTotals[label].toFixed(2);
        }
    });
}


// =============================
// EVENT HANDLERS
// =============================
function selectCategory(button) {
    // Remove active class from all buttons
    const allButtons = document.querySelectorAll('.category-btn');
    allButtons.forEach(btn => btn.classList.remove('active'));
    // Add active class to clicked button
    button.classList.add('active');
    // Store selected category
    selectedCategory = button.textContent;
    // Update the usage label
    document.getElementById('categoryLabel').textContent = selectedCategory;
    // Show/hide temperature input based on selection
    const tempInput = document.getElementById('temperatureInput');
    if (selectedCategory === 'Frozen Meats') {
        tempInput.classList.add('show');
    } else {
        tempInput.classList.remove('show');
    }
}


function handleCompanyChange() {
    const select = document.getElementById('companySelect');
    const addNewDonorSection = document.getElementById('addNewDonorSection');
    if (select && addNewDonorSection) {
        const row = select.closest('.company-row');
        if (row) row.classList.toggle('is-adding', select.value === 'New');
        if (select.value === 'New') {
            addNewDonorSection.style.display = 'flex';
            const newDonorInput = document.getElementById('newDonorInput');
            if (newDonorInput) newDonorInput.focus();
        } else {
            addNewDonorSection.style.display = 'none';
        }
    }
}


// =============================
// INITIALIZATION
// =============================
document.addEventListener('DOMContentLoaded', function() {
    updateCompanyDropdown();
    // Allow donor-management page to trigger dropdown update if opened as popup
    window.updateCompanyDropdown = updateCompanyDropdown;

    // Refresh dropdown when returning to this page (incl. back/forward cache)
    window.addEventListener('pageshow', updateCompanyDropdown);
    window.addEventListener('focus', updateCompanyDropdown);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateCompanyDropdown();
    });
    window.addEventListener('storage', (e) => {
        if (e.key === 'donorList' || e.key === 'donorSortMode' || e.key === 'donorFavorites') updateCompanyDropdown();
    });

    // Company select
    const select = document.getElementById('companySelect');
    if (select) {
        select.addEventListener('change', handleCompanyChange);
    }
    // Log weight button
    const logBtn = document.querySelector('.log-weight-btn');
    if (logBtn) {
        logBtn.addEventListener('click', logWeight);
    }
    // Action buttons
    const undoBtn = document.querySelector('.btn-submit');
    if (undoBtn) undoBtn.addEventListener('click', undoLastMeasurement);
    const clearBtn = document.querySelector('.btn-reset');
    if (clearBtn) clearBtn.addEventListener('click', clearCategory);
    const restartBtns = document.querySelectorAll('.btn-submit');
    if (restartBtns.length > 1) restartBtns[1].addEventListener('click', restartDonation);

    // Apply new donor button
    const applyDonorBtn = document.getElementById('applyDonorBtn');
    if (applyDonorBtn) {
        applyDonorBtn.addEventListener('click', applyNewDonor);
    }

    // Allow pressing Enter in the inline donor input
    const newDonorInput = document.getElementById('newDonorInput');
    if (newDonorInput) {
        newDonorInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyNewDonor();
            }
        });
    }

    // Submit donation button
    const submitDonationBtn = document.querySelector('.submit-donation-btn');
    if (submitDonationBtn) {
        submitDonationBtn.addEventListener('click', handleSubmitDonation);
    }
});
