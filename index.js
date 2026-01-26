// =============================
// DONATION SUBMIT LOGIC
// =============================
function handleSubmitDonation() {
    const companySelect = document.getElementById('companySelect');
    const companyName = companySelect ? companySelect.value : '';
    if (!companyName) {
        alert('Please select a company.');
        return;
    }
    // Get totals
    // Get temperature if Frozen Meats is present
    let temperature = '';
    if ((categoryTotals['Frozen Meats'] || 0) > 0) {
        const tempInput = document.getElementById('temperatureInput');
        if (tempInput && tempInput.value) {
            temperature = tempInput.value;
        }
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
        // Pretty, black and white receipt with logo
        const receipt = `
        <html><head><title>Donation Receipt</title>
        <style>
            body { font-family: Arial, sans-serif; color: #111; background: #fff; margin: 0; padding: 0; }
            .receipt-container { max-width: 420px; margin: 24px auto; border: 2px solid #111; border-radius: 10px; padding: 24px 32px; background: #fff; }
            .logo { display: block; margin: 0 auto 16px auto; max-width: 120px; }
            h1 { text-align: center; font-size: 1.6em; margin-bottom: 0.2em; letter-spacing: 1px; }
            .subtitle { text-align: center; font-size: 1em; margin-bottom: 1.2em; color: #222; }
            .info-table { width: 100%; margin-bottom: 1.2em; border-collapse: collapse; }
            .info-table td { padding: 4px 0; font-size: 1em; }
            .donation-table { width: 100%; border-collapse: collapse; margin-bottom: 1.2em; }
            .donation-table th, .donation-table td { border: 1px solid #111; padding: 6px 10px; font-size: 1em; text-align: left; }
            .donation-table th { background: #eee; }
            .footer { text-align: center; font-size: 0.95em; margin-top: 1.5em; color: #222; }
        </style>
        </head><body>
        <div class="receipt-container">
            <img src="images/HCFP-Logo-Edited-removebg-preview.png" class="logo" alt="HCFP Logo">
            <h1>Donation Receipt</h1>
            <div class="subtitle">Hancock County Food Pantry</div>
            <table class="info-table">
                <tr><td><strong>Date & Time:</strong></td><td>${donation.dateTime}</td></tr>
                <tr><td><strong>Company Name:</strong></td><td>${donation.companyName}</td></tr>
            </table>
            <table class="donation-table">
                <tr><th>Category</th><th>Weight (lbs)</th>${donation.temperature ? '<th>Temp (°F)</th>' : ''}</tr>
                <tr><td>Produce</td><td>${donation.Produce.toFixed(2)}</td>${donation.temperature ? '<td rowspan=5 style="vertical-align:middle;text-align:center;font-weight:bold;">' + donation.temperature + '</td>' : ''}</tr>
                <tr><td>Frozen Meats</td><td>${donation['Frozen Meats'].toFixed(2)}</td></tr>
                <tr><td>Misc Frozen</td><td>${donation['Misc Frozen'].toFixed(2)}</td></tr>
                <tr><td>Bakery</td><td>${donation.Bakery.toFixed(2)}</td></tr>
                <tr><td>Dry</td><td>${donation.Dry.toFixed(2)}</td></tr>
            </table>
            <div class="footer">Thank you for your generous donation!</div>
        </div>
        <script>window.onload = function() { window.print(); }<\/script>
        </body></html>
        `;
        const win = window.open('', '_blank');
        win.document.write(receipt);
    }
    // Redirect to Donations Management page
    window.location.href = 'donations-management.html';
}
// =============================
// DONOR DROPDOWN SYNC
// =============================
function updateCompanyDropdown() {
    const companySelect = document.getElementById('companySelect');
    if (!companySelect) return;
    // Save current selection
    const current = companySelect.value;
    // Remove all except the first (placeholder) and last (Add New Donor)
    while (companySelect.options.length > 2) {
        companySelect.remove(1);
    }
    // Get donors from localStorage
    let donors = [];
    try {
        donors = JSON.parse(localStorage.getItem('donorList')) || [];
    } catch {}
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
    donors.forEach(name => {
        // Don't add if already present (shouldn't happen)
        if ([...companySelect.options].some(opt => opt.text.toLowerCase() === name.toLowerCase())) return;
        const opt = document.createElement('option');
        opt.value = name;
        opt.text = name;
        companySelect.add(opt, companySelect.options.length - 1);
    });
    // Restore selection if possible
    companySelect.value = current;
}
// =============================
// ADD NEW DONOR LOGIC
// =============================
function applyNewDonor() {
    const newDonorInput = document.getElementById('newDonorInput');
    const companySelect = document.getElementById('companySelect');
    if (!newDonorInput || !companySelect) return;
    const newDonor = newDonorInput.value.trim();
    if (!newDonor) {
        alert('Please enter a donor name.');
        return;
    }
    // Check for duplicates (case-insensitive)
    for (let i = 0; i < companySelect.options.length; i++) {
        if (companySelect.options[i].text.toLowerCase() === newDonor.toLowerCase()) {
            alert('That donor already exists in the list.');
            return;
        }
    }
    // Add new donor before the 'Add New Donor' option
    const newOption = document.createElement('option');
    newOption.value = newDonor;
    newOption.text = newDonor;
    // Insert before last option (assumed to be 'Add New Donor')
    companySelect.add(newOption, companySelect.options.length - 1);
    companySelect.value = newDonor;
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
    if (usageValueElem) usageValueElem.textContent = '0.00';
    // Optionally reset company and donor fields
    const companySelect = document.getElementById('companySelect');
    if (companySelect) companySelect.value = '';
    const newDonorInput = document.getElementById('newDonorInput');
    if (newDonorInput) newDonorInput.value = '';
    document.getElementById('addNewDonorSection').style.display = 'none';
}

function logWeight() {
    const category = selectedCategory;
    if (!category || !(category in categoryTotals)) {
        alert('Please select a category.');
        return;
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
        if (select.value === 'New') {
            addNewDonorSection.style.display = '';
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

    // Submit donation button
    const submitDonationBtn = document.querySelector('.submit-donation-btn');
    if (submitDonationBtn) {
        submitDonationBtn.addEventListener('click', handleSubmitDonation);
    }
});
