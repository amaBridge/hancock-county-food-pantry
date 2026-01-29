// ============================================================
// index.js
// ============================================================
// Home page logic (index.html)
//
// Quick navigation
// - Donation submit / receipt: handleSubmitDonation()
// - Company dropdown sync:     updateCompanyDropdown()
// - Donor add/select (typed):  addOrSelectDonorByName(), handleCompanyChange()
// - Category + weight logging: selectCategory(), logWeight(), totals
// - Startup wiring:            DOMContentLoaded handler at bottom
// ============================================================

// =============================
// DONATION SUBMIT LOGIC
// =============================
// Mobile Safari sometimes sends a "ghost click" after interacting with
// a <select> or an overlay list. If the UI closes under the finger, that
// click can land on an element underneath (e.g., a category button).
let suppressCategoryClicksUntil = 0;
function armCategoryClickSuppression(durationMs = 450) {
    suppressCategoryClicksUntil = Math.max(suppressCategoryClicksUntil, Date.now() + durationMs);
}
function shouldSuppressCategoryClicksNow() {
    return Date.now() < suppressCategoryClicksUntil;
}

// If the user actually taps/clicks a category button, we should not suppress it.
// Track recent pointer/touch/mouse-down on category buttons so we can distinguish
// deliberate interaction from "ghost clicks".
let lastCategoryPointerDownAt = 0;
function markCategoryPointerDown(e) {
    const btn = e?.target && e.target.closest ? e.target.closest('.category-btn') : null;
    if (!btn) return;
    lastCategoryPointerDownAt = Date.now();
}

let donorComboBackdropTimer = null;
function setDonorComboBackdropOpen(isOpen, { lingerMs = 0 } = {}) {
    const backdrop = document.getElementById('donorComboBackdrop');
    if (!backdrop) return;

    if (donorComboBackdropTimer) {
        clearTimeout(donorComboBackdropTimer);
        donorComboBackdropTimer = null;
    }

    if (isOpen) {
        backdrop.classList.add('open');
        return;
    }

    if (lingerMs > 0) {
        // Keep the backdrop around briefly to absorb any delayed/ghost clicks.
        donorComboBackdropTimer = setTimeout(() => {
            backdrop.classList.remove('open');
            donorComboBackdropTimer = null;
        }, lingerMs);
    } else {
        backdrop.classList.remove('open');
    }
}

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
        try { document.getElementById('donorComboInput')?.focus(); } catch { }
        return;
    }

    // "Add New Donor..." is now handled via the combobox typed text.
    if (String(companyName).toLowerCase() === 'new') {
        const typed = String(document.getElementById('donorComboInput')?.value || '').trim();
        if (typed) {
            const createdOrSelected = addOrSelectDonorByName(typed);
            if (!createdOrSelected) return;
            companyName = companySelect ? companySelect.value : '';
        }

        if (!companyName || String(companyName).toLowerCase() === 'new') {
            alert('Please type/select a donor before submitting.');
            try { document.getElementById('donorComboInput')?.focus(); } catch { }
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

    // Keep the combobox UI (if present) in sync with the backing <select>.
    if (typeof syncDonorComboboxFromSelect === 'function') {
        syncDonorComboboxFromSelect();
    }

    // If the list is open, refresh visible items.
    if (typeof renderDonorComboboxList === 'function') {
        renderDonorComboboxList();
    }
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
    if (!confirm(`Clear the total for "${selectedCategory}"?`)) return;
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
    selectedCategory = '';

    // Clear any selected category button UI state
    document.querySelectorAll('.category-btn.active').forEach(btn => btn.classList.remove('active'));

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
    if (typeof syncDonorComboboxFromSelect === 'function') {
        syncDonorComboboxFromSelect();
    }

    const tempInput = document.getElementById('temperatureInput');
    if (tempInput) {
        tempInput.value = '';
        tempInput.classList.remove('show');
    }

    // (Old inline add-donor UI removed)
}

function logWeight() {
    // Records a single weight entry into the selected category total.
    // Require a donor selection/add first (prevents weights being entered without a company).
    const companySelect = document.getElementById('companySelect');
    const companyName = companySelect ? companySelect.value : '';
    if (!companyName || String(companyName).toLowerCase() === 'new') {
        alert('Please select or add a donor (company) before logging weight.');
        try { document.getElementById('donorComboInput')?.focus(); } catch { }
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


// =============================
// NAVBAR (Hamburger toggle)
// =============================
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


function handleCompanyChange() {
    const select = document.getElementById('companySelect');
    if (!select) return;

    // Inline add-donor UI has been removed; keep the layout class in a safe state.
    const row = select.closest('.company-row');
    if (row) row.classList.remove('is-adding');
}


// =============================
// DONOR COMBOBOX (Home page)
// =============================
let donorComboOpen = false;
let donorComboActiveIndex = -1;
let donorComboItems = [];
let donorComboQuery = '';

// Touch/scroll helpers (iOS Safari can emit a click after a scroll gesture)
let donorComboLastTouchMoveAt = 0;
let donorComboSuppressClickUntil = 0;
let donorComboHasTouchEvents = false;
function donorComboTouchWasMovingRecently(windowMs = 220) {
    return Date.now() - donorComboLastTouchMoveAt < windowMs;
}

function adjustDonorComboboxDropdownPlacement() {
    const combo = document.getElementById('donorCombobox');
    const input = document.getElementById('donorComboInput');
    const list = document.getElementById('donorComboList');
    if (!combo || !input || !list) return;
    if (!donorComboOpen) return;

    // Use visualViewport so iOS keyboard reduces the measured height.
    const vv = window.visualViewport;
    const viewportHeight = vv && Number.isFinite(vv.height) ? vv.height : window.innerHeight;

    const inputRect = input.getBoundingClientRect();
    const padding = 12;
    const spaceBelow = Math.max(0, viewportHeight - inputRect.bottom - padding);
    const spaceAbove = Math.max(0, inputRect.top - padding);

    // Bigger dropdown: use a % of the *visible* viewport (shrinks automatically when keyboard shows).
    // Cap it so it never becomes absurdly large on desktop.
    const desiredMax = Math.min(560, Math.max(260, Math.floor(viewportHeight * 0.55)));
    const minUsable = 140;
    const shouldDropUp = spaceBelow < minUsable && spaceAbove > spaceBelow;

    list.classList.toggle('drop-up', shouldDropUp);

    const available = shouldDropUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(140, Math.min(desiredMax, Math.floor(available)));
    list.style.maxHeight = `${maxHeight}px`;
}

// When a native modal (confirm/alert) returns focus to the input, it can retrigger
// our focus handler and reopen the dropdown. Use a short suppression window.
let donorComboSuppressOpenUntil = 0;
function suppressDonorComboboxAutoOpen(ms = 900) {
    donorComboSuppressOpenUntil = Date.now() + Math.max(0, Number(ms) || 0);
}

function finalizeDonorSelection({ closeDropdown = true, blurInput = true } = {}) {
    // Close the dropdown and hide the mobile keyboard by blurring the input.
    const input = document.getElementById('donorComboInput');
    if (closeDropdown && typeof closeDonorCombobox === 'function') {
        suppressDonorComboboxAutoOpen(900);
        // When a user explicitly picks/adds a donor, close immediately so the
        // full-screen backdrop doesn't block category buttons.
        closeDonorCombobox({ lingerMs: 0 });
    }
    if (blurInput && input) {
        // On mobile browsers (notably iOS), blur can be ignored if it's deferred.
        // Try immediately (within the user gesture), then retry once shortly after.
        try { input.blur(); } catch { }
        setTimeout(() => {
            try { input.blur(); } catch { }
        }, 50);
    }
}

let appToastTimer = null;

function showAppToast(message, { timeoutMs = 2400 } = {}) {
    const el = document.getElementById('appToast');
    if (!el) return;

    const text = String(message || '').trim();
    if (!text) return;

    el.textContent = text;
    el.classList.remove('show');
    // Force reflow so repeated messages animate.
    // eslint-disable-next-line no-unused-expressions
    el.offsetHeight;
    el.classList.add('show');

    if (appToastTimer) {
        clearTimeout(appToastTimer);
        appToastTimer = null;
    }

    appToastTimer = setTimeout(() => {
        try { el.classList.remove('show'); } catch { }
    }, Math.max(800, Number(timeoutMs) || 2400));
}

function normalizeDonorLabel(text) {
    return String(text || '').replace(/^★\s*/, '').trim();
}

function findExistingDonorValueByName(name) {
    const select = document.getElementById('companySelect');
    const needle = String(name || '').trim().toLowerCase();
    if (!select || !needle) return '';

    const opts = [...select.options].filter(o => String(o.value || '') !== '' && String(o.value || '').toLowerCase() !== 'new');
    const match = opts.find(o => {
        const label = normalizeDonorLabel(o.textContent || o.value);
        return String(label || '').trim().toLowerCase() === needle;
    });
    return match ? String(match.value || '') : '';
}

function addOrSelectDonorByName(name) {
    const select = document.getElementById('companySelect');
    const input = document.getElementById('donorComboInput');
    const typed = String(name || '').trim();
    if (!select) return '';
    if (!typed) {
        alert('Type a donor name first.');
        try { input?.focus(); } catch { }
        return '';
    }

    // If it already exists, just select it.
    const existingValue = findExistingDonorValueByName(typed);
    if (existingValue) {
        setSelectedDonorValue(existingValue);
        return existingValue;
    }

    // Otherwise add it to storage (case-insensitive de-dupe).
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

    const already = donors.find(d => String(d || '').trim().toLowerCase() === typed.toLowerCase());
    const canonical = already ? String(already).trim() : typed;
    const didCreate = !already;
    if (didCreate) {
        // Prevent the confirm dialog from causing a focus-triggered re-open.
        suppressDonorComboboxAutoOpen(1200);
        const ok = confirm(`Add new donor "${canonical}"?`);
        if (!ok) {
            showAppToast('New donor was not added.');
            try { input?.focus(); } catch { }
            return '';
        }

        donors.push(canonical);
        localStorage.setItem('donorList', JSON.stringify(donors));
        updateCompanyDropdown();
    }

    setSelectedDonorValue(canonical);

    if (didCreate) {
        showAppToast(`New donor added: ${canonical}`);

        // Finish the selection on mobile (close dropdown + keyboard).
        finalizeDonorSelection({ closeDropdown: true, blurInput: true });
    }
    return canonical;
}

function syncDonorComboboxFromSelect() {
    const input = document.getElementById('donorComboInput');
    const select = document.getElementById('companySelect');
    const combo = document.getElementById('donorCombobox');
    const clearBtn = document.getElementById('donorComboClear');
    if (!input || !select) return;

    const value = select.value;
    if (!value) {
        input.value = '';
        donorComboQuery = '';
        if (combo) combo.classList.remove('has-value');
        if (clearBtn) clearBtn.setAttribute('aria-hidden', 'true');
        return;
    }

    // If the user selected "Add New Donor...", keep the combobox input empty so it
    // doesn't filter the list down to only that entry (which looks like donors disappeared).
    if (String(value).toLowerCase() === 'new') {
        input.value = '';
        donorComboQuery = '';
        if (combo) combo.classList.remove('has-value');
        if (clearBtn) clearBtn.setAttribute('aria-hidden', 'true');
        return;
    }

    const opt = [...select.options].find(o => o.value === value);
    input.value = normalizeDonorLabel(opt ? opt.textContent : value);
    donorComboQuery = '';

    if (combo) combo.classList.add('has-value');
    if (clearBtn) clearBtn.setAttribute('aria-hidden', 'false');
}

function getDonorComboboxOptionItems() {
    const select = document.getElementById('companySelect');
    const input = document.getElementById('donorComboInput');
    if (!select || !input) return [];

    const query = String(donorComboQuery || '').trim().toLowerCase();

    // Only show "Add New Donor..." if there are no other results.
    const donorOptions = [...select.options]
        .filter(opt => String(opt.value || '') !== '') // exclude placeholder
        .filter(opt => String(opt.value || '').toLowerCase() !== 'new');

    const filteredDonors = donorOptions.filter(opt => {
        if (!query) return true;
        const label = normalizeDonorLabel(opt.textContent || opt.value);
        return label.toLowerCase().includes(query);
    });

    const mappedDonors = filteredDonors.map(opt => {
        const rawText = String(opt.textContent || opt.value || '');
        const isFavorite = /^\s*★\s*/.test(rawText);
        return {
            value: opt.value,
            label: normalizeDonorLabel(rawText),
            isAddNew: false,
            isFavorite
        };
    });

    if (mappedDonors.length > 0) return mappedDonors;

    // No donor matches: show the add-new option.
    const addOpt = [...select.options].find(o => String(o.value || '').toLowerCase() === 'new');
    return [{
        value: addOpt ? addOpt.value : 'New',
        label: 'Add New Donor...',
        isAddNew: true,
        isFavorite: false
    }];
}

function openDonorCombobox() {
    donorComboOpen = true;
    // Start with no highlighted row; hover/keyboard will set it.
    donorComboActiveIndex = -1;
    // Default to showing the full list when opening.
    donorComboQuery = '';
    setDonorComboBackdropOpen(true);
    renderDonorComboboxList();
    adjustDonorComboboxDropdownPlacement();
}

function closeDonorCombobox({ lingerMs = 800 } = {}) {
    donorComboOpen = false;
    donorComboActiveIndex = -1;
    const list = document.getElementById('donorComboList');
    if (list) {
        list.classList.remove('open');
        list.classList.remove('drop-up');
        list.style.maxHeight = '';
    }

    // Linger briefly to prevent click-through on touch devices.
    setDonorComboBackdropOpen(false, { lingerMs });
}

function setSelectedDonorValue(value) {
    const select = document.getElementById('companySelect');
    if (!select) return;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    donorComboQuery = '';
    syncDonorComboboxFromSelect();
}

function renderDonorComboboxList() {
    const list = document.getElementById('donorComboList');
    const input = document.getElementById('donorComboInput');
    if (!list || !input) return;

    if (!donorComboOpen) {
        list.classList.remove('open');
        return;
    }

    donorComboItems = getDonorComboboxOptionItems();

    // Clamp active index
    if (donorComboActiveIndex < -1) donorComboActiveIndex = -1;
    if (donorComboActiveIndex >= donorComboItems.length) donorComboActiveIndex = donorComboItems.length - 1;

    list.innerHTML = '';

    if (donorComboItems.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'donor-combo-item muted';
        empty.textContent = 'No matches';
        list.appendChild(empty);
        list.classList.add('open');
        return;
    }

    donorComboItems.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'donor-combo-item' + (idx === donorComboActiveIndex ? ' active' : '');
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', idx === donorComboActiveIndex ? 'true' : 'false');
        const typedLabel = String(input.value || '').trim();
        row.textContent = item.isAddNew
            ? (typedLabel ? `Add New Donor: "${typedLabel}"` : 'Add New Donor...')
            : (item.isFavorite ? `★ ${item.label}` : item.label);

        // Hover behavior: move the green highlight to the row under the mouse.
        row.addEventListener('pointerenter', () => {
            if (!donorComboOpen) return;
            if (donorComboActiveIndex === idx) return;
            donorComboActiveIndex = idx;
            // Update highlight in-place (no full rerender needed)
            const children = list.children;
            for (let i = 0; i < children.length; i++) {
                const el = children[i];
                const isActive = i === donorComboActiveIndex;
                el.classList.toggle('active', isActive);
                el.setAttribute('aria-selected', isActive ? 'true' : 'false');
            }
        });

        // On touch devices, users need to be able to scroll the dropdown list.
        // Selecting on pointerdown breaks scrolling (a swipe immediately picks an item).
        const selectThisRow = (e, { bypassSuppression = false } = {}) => {
            // If the user was scrolling, ignore the tap/click.
            if (!bypassSuppression) {
                if (donorComboTouchWasMovingRecently(260)) return;
                if (Date.now() < donorComboSuppressClickUntil) return;
            }

            e?.preventDefault?.();
            e?.stopPropagation?.();

            // Short suppression window to avoid ghost clicks without making the
            // next intentional tap feel "dead".
            armCategoryClickSuppression(200);

            if (item.isAddNew) {
                const typed = String(input.value || '').trim();
                const createdOrSelected = addOrSelectDonorByName(typed);
                if (createdOrSelected) finalizeDonorSelection({ closeDropdown: true, blurInput: true });
                return;
            }

            setSelectedDonorValue(item.value);
            finalizeDonorSelection({ closeDropdown: true, blurInput: true });
        };

        // Desktop/mouse
        row.addEventListener('click', (e) => selectThisRow(e));

        // Mobile/touch: only select on touchend if the finger didn't move (scroll).
        let touchStartX = 0;
        let touchStartY = 0;
        let touchMoved = false;
        row.addEventListener('touchstart', (e) => {
            donorComboHasTouchEvents = true;
            const t = e.touches && e.touches[0];
            if (!t) return;
            touchStartX = t.clientX;
            touchStartY = t.clientY;
            touchMoved = false;
        }, { passive: true });

        row.addEventListener('touchmove', (e) => {
            const t = e.touches && e.touches[0];
            if (!t) return;
            const dx = Math.abs(t.clientX - touchStartX);
            const dy = Math.abs(t.clientY - touchStartY);
            if (dx > 8 || dy > 8) {
                touchMoved = true;
                donorComboLastTouchMoveAt = Date.now();
            }
        }, { passive: true });

        row.addEventListener('touchend', (e) => {
            if (touchMoved) return;
            // Select immediately on a tap, but suppress the synthetic click iOS may fire after.
            selectThisRow(e, { bypassSuppression: true });
            donorComboSuppressClickUntil = Date.now() + 650;
        }, { passive: false });

        // iPad "Request Desktop Website" often relies on Pointer Events instead of Touch Events.
        // Add pointer-based tap selection while preserving scroll.
        let ptrId = null;
        let ptrStartX = 0;
        let ptrStartY = 0;
        let ptrMoved = false;

        row.addEventListener('pointerdown', (e) => {
            // If the browser is already giving us touch events, avoid double-handling.
            if (donorComboHasTouchEvents) return;
            if (e.pointerType === 'mouse') return;
            ptrId = e.pointerId;
            ptrStartX = e.clientX;
            ptrStartY = e.clientY;
            ptrMoved = false;
        }, { passive: true });

        row.addEventListener('pointermove', (e) => {
            if (donorComboHasTouchEvents) return;
            if (e.pointerType === 'mouse') return;
            if (ptrId === null || e.pointerId !== ptrId) return;
            const dx = Math.abs(e.clientX - ptrStartX);
            const dy = Math.abs(e.clientY - ptrStartY);
            if (dx > 8 || dy > 8) {
                ptrMoved = true;
                donorComboLastTouchMoveAt = Date.now();
            }
        }, { passive: true });

        row.addEventListener('pointerup', (e) => {
            if (donorComboHasTouchEvents) return;
            if (e.pointerType === 'mouse') return;
            if (ptrId === null || e.pointerId !== ptrId) return;
            ptrId = null;
            if (ptrMoved) return;

            // Treat as a tap.
            selectThisRow(e, { bypassSuppression: true });
            donorComboSuppressClickUntil = Date.now() + 650;
        }, { passive: false });

        list.appendChild(row);
    });

    list.classList.add('open');
    adjustDonorComboboxDropdownPlacement();
}

function initDonorCombobox() {
    const combo = document.getElementById('donorCombobox');
    const input = document.getElementById('donorComboInput');
    const list = document.getElementById('donorComboList');
    const select = document.getElementById('companySelect');
    const backdrop = document.getElementById('donorComboBackdrop');
    const clearBtn = document.getElementById('donorComboClear');
    if (!combo || !input || !list || !select) return;

    function focusDonorInputInGesture() {
        // On iOS Safari, keyboard only appears if focus happens inside a user gesture.
        try {
            // Some browsers support the options object.
            input.focus({ preventScroll: true });
        } catch {
            try { input.focus(); } catch { }
        }
    }

    function openAndFocusFromGesture(e) {
        const target = e?.target;
        // Ignore taps on list items (they have their own selection handlers)
        if (target && target.closest && target.closest('#donorComboList')) return;
        if (clearBtn && target === clearBtn) return;

        focusDonorInputInGesture();

        // Open the dropdown immediately (still inside the gesture).
        if (Date.now() >= donorComboSuppressOpenUntil) {
            if (!donorComboOpen) openDonorCombobox();
            else adjustDonorComboboxDropdownPlacement();
        }

        // Some iOS versions will only show the keyboard if focus is called on touchend.
        // Calling it again is harmless elsewhere.
        try { input.focus({ preventScroll: true }); } catch { try { input.focus(); } catch { } }
    }

    // If the user taps the combobox container (padding/empty area), still focus the input
    // so the keyboard appears on the first tap.
    combo.addEventListener('pointerdown', openAndFocusFromGesture);
    combo.addEventListener('pointerup', openAndFocusFromGesture);
    // iOS Safari: focus must often occur on touchend to open the keyboard.
    combo.addEventListener('touchend', openAndFocusFromGesture, { passive: true });
    combo.addEventListener('click', openAndFocusFromGesture);

    // If the list scrolls (or a touchmove happens inside it), ignore any immediate clicks.
    list.addEventListener('scroll', () => {
        donorComboLastTouchMoveAt = Date.now();
    }, { passive: true });

    list.addEventListener('touchmove', () => {
        donorComboHasTouchEvents = true;
        donorComboLastTouchMoveAt = Date.now();
    }, { passive: true });

    list.addEventListener('pointermove', (e) => {
        if (e && e.pointerType && e.pointerType !== 'mouse') {
            donorComboLastTouchMoveAt = Date.now();
        }
    }, { passive: true });

    function updateClearState() {
        const hasValue = Boolean(String(input.value || '').trim()) && String(select.value || '').toLowerCase() !== 'new';
        combo.classList.toggle('has-value', hasValue);
        if (clearBtn) clearBtn.setAttribute('aria-hidden', hasValue ? 'false' : 'true');
    }

    syncDonorComboboxFromSelect();
    updateClearState();

    let lastEnterHandledAt = 0;
    function handleDonorComboEnter(e) {
        const now = Date.now();
        if (now - lastEnterHandledAt < 150) return;
        lastEnterHandledAt = now;

        e?.preventDefault?.();

        // If the user typed an exact match, select it.
        const typedLower = String(input.value || '').trim().toLowerCase();
        const candidates = getDonorComboboxOptionItems().filter(i => !i.isAddNew);
        const exact = candidates.find(i => String(i.label || '').toLowerCase() === typedLower);
        if (exact) {
            setSelectedDonorValue(exact.value);
            finalizeDonorSelection({ closeDropdown: true, blurInput: true });
            return;
        }

        if (!donorComboOpen) {
            openDonorCombobox();
            return;
        }

        // If nothing is highlighted, default to the first item on Enter.
        if (donorComboActiveIndex < 0) donorComboActiveIndex = 0;

        // If the list is empty (should be rare), just leave it open.
        const chosen = donorComboItems[donorComboActiveIndex];
        if (!chosen) return;

        if (chosen.isAddNew) {
            const createdOrSelected = addOrSelectDonorByName(String(input.value || '').trim());
            if (createdOrSelected) finalizeDonorSelection({ closeDropdown: true, blurInput: true });
            return;
        }

        setSelectedDonorValue(chosen.value);
        finalizeDonorSelection({ closeDropdown: true, blurInput: true });
    }

    input.addEventListener('focus', () => {
        if (Date.now() < donorComboSuppressOpenUntil) return;
        openDonorCombobox();
    });

    // If the input never lost focus (e.g., user clicked on a non-focusable area),
    // focusing won't fire again. Allow click/tap to reopen the dropdown.
    input.addEventListener('pointerdown', () => {
        if (Date.now() < donorComboSuppressOpenUntil) return;
        if (!donorComboOpen) openDonorCombobox();
        else adjustDonorComboboxDropdownPlacement();
    });

    input.addEventListener('input', () => {
        // When the user types, that becomes the active filter query.
        donorComboQuery = String(input.value || '');
        if (!donorComboOpen) donorComboOpen = true;
        donorComboActiveIndex = 0;
        renderDonorComboboxList();
        updateClearState();
        adjustDonorComboboxDropdownPlacement();
    });

    // Keyboard-aware resizing (iOS Safari)
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', adjustDonorComboboxDropdownPlacement);
        window.visualViewport.addEventListener('scroll', adjustDonorComboboxDropdownPlacement);
    }
    window.addEventListener('resize', adjustDonorComboboxDropdownPlacement);

    // Mobile keyboards sometimes don't emit a reliable keydown for Enter/Done.
    // beforeinput fires with insertLineBreak/insertParagraph on many browsers.
    input.addEventListener('beforeinput', (e) => {
        const type = String(e?.inputType || '');
        if (type === 'insertLineBreak' || type === 'insertParagraph') {
            handleDonorComboEnter(e);
        }
    });

    if (clearBtn) {
        const clear = (e) => {
            e.preventDefault();
            e.stopPropagation();
            armCategoryClickSuppression();

            // Clear both UI and backing <select>.
            select.value = '';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            donorComboQuery = '';
            input.value = '';
            updateClearState();

            try { input.focus(); } catch { }
            openDonorCombobox();
        };
        // pointerdown avoids blur-first behavior on touch.
        clearBtn.addEventListener('pointerdown', clear);
        clearBtn.addEventListener('click', clear);
    }

    input.addEventListener('keydown', (e) => {
        const key = e.key;
        if (key === 'ArrowDown') {
            e.preventDefault();
            if (!donorComboOpen) openDonorCombobox();
            else {
                if (donorComboActiveIndex < 0) donorComboActiveIndex = 0;
                else donorComboActiveIndex = Math.min(donorComboActiveIndex + 1, donorComboItems.length - 1);
                renderDonorComboboxList();
            }
            return;
        }
        if (key === 'ArrowUp') {
            e.preventDefault();
            if (!donorComboOpen) openDonorCombobox();
            else {
                if (donorComboActiveIndex < 0) donorComboActiveIndex = Math.max(donorComboItems.length - 1, 0);
                else donorComboActiveIndex = Math.max(donorComboActiveIndex - 1, 0);
                renderDonorComboboxList();
            }
            return;
        }
        if (key === 'Escape') {
            e.preventDefault();
            closeDonorCombobox();
            return;
        }
        if (key === 'Enter') {
            handleDonorComboEnter(e);
            return;
        }
    });

    // Extra fallback: some mobile browsers only deliver Enter on keyup.
    input.addEventListener('keyup', (e) => {
        const key = e.key;
        const code = /** @type {any} */ (e).keyCode;
        if (key === 'Enter' || code === 13) {
            handleDonorComboEnter(e);
        }
    });

    // Close when clicking outside
    document.addEventListener('pointerdown', (e) => {
        if (combo.contains(e.target)) return;
        closeDonorCombobox();
    });

    // Backdrop closes the list and absorbs taps/clicks.
    if (backdrop) {
        backdrop.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeDonorCombobox();
        });
        backdrop.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    }

    // When the hidden select changes (e.g., after adding a donor), sync input text
    select.addEventListener('change', () => {
        syncDonorComboboxFromSelect();
        updateClearState();
    });
}


// =============================
// INITIALIZATION
// =============================
document.addEventListener('DOMContentLoaded', function() {
    initNavbarMenu();

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

        // Guard against ghost-clicks after native select interactions.
        select.addEventListener('change', () => armCategoryClickSuppression(200));
        select.addEventListener('pointerdown', () => armCategoryClickSuppression(200));
    }

    // Capture-phase suppression so inline onclick handlers never fire.
    // Also mark real pointer interactions so we don't suppress intentional taps.
    document.addEventListener('pointerdown', markCategoryPointerDown, true);
    document.addEventListener('touchstart', markCategoryPointerDown, true);
    document.addEventListener('mousedown', markCategoryPointerDown, true);

    document.addEventListener('click', (e) => {
        if (!shouldSuppressCategoryClicksNow()) return;
        const targetBtn = e.target && e.target.closest ? e.target.closest('.category-btn') : null;
        if (!targetBtn) return;

        // If the user actually pressed on a category button, allow it.
        // (Ghost clicks often arrive without a preceding down event.)
        if (Date.now() - lastCategoryPointerDownAt < 800) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        e.stopPropagation();
    }, true);

    // Donor combobox (type-to-filter)
    initDonorCombobox();

    // Category buttons (no inline onclick in HTML)
    document.querySelectorAll('.category-btn').forEach((btn) => {
        btn.addEventListener('click', () => selectCategory(btn));
    });

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

    // Submit donation button
    const submitDonationBtn = document.querySelector('.submit-donation-btn');
    if (submitDonationBtn) {
        submitDonationBtn.addEventListener('click', handleSubmitDonation);
    }
});
