const fs = require('fs');
const path = require('path');
const dataFilePath = path.join(__dirname, 'data.json');

function readData() {
    if (!fs.existsSync(dataFilePath)) {
        return { donationsList: [], donorList: [] };
    }
    const data = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(data);
}

function writeData(newData) {
    fs.writeFileSync(dataFilePath, JSON.stringify(newData, null, 2), 'utf8');
}

// Replace localStorage.getItem and localStorage.setItem
function getDonations() {
    const data = readData();
    return data.donationsList || [];
}

function setDonations(donations) {
    const data = readData();
    data.donationsList = donations;
    writeData(data);
}

function getDonors() {
    const data = readData();
    return data.donorList || [];
}

function setDonors(donors) {
    const data = readData();
    data.donorList = donors;
    writeData(data);
}

// Update all references to localStorage
function handleSubmitDonation() {
    const companySelect = document.getElementById('companySelect');
    const companyName = companySelect ? companySelect.value : '';
    if (!companyName) {
        alert('Please select a company.');
        return;
    }
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
    let donations = getDonations();
    donations.push(donation);
    setDonations(donations);
    alert('Donation submitted successfully!');
    location.reload();
}

function renderDonorList() {
    const donorList = document.getElementById('donorList');
    donorList.innerHTML = '';
    let donors = getDonors();
    donors.forEach((donor) => {
        const li = document.createElement('li');
        li.textContent = donor;
        donorList.appendChild(li);
    });
}

// =============================
// DONATIONS MANAGEMENT LOGIC
// =============================
document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.querySelector('#donationsTable tbody');
    const orderToggleBtn = document.getElementById('orderToggleBtn');
    let isDescending = true;

    function loadDonations() {
        tableBody.innerHTML = '';
        let donations = getDonations();
        donations.sort((a, b) => {
            let dateA = new Date(a.dateTime);
            let dateB = new Date(b.dateTime);
            return isDescending ? dateB - dateA : dateA - dateB;
        });
        donations.forEach((donation, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${donation.dateTime}</td>
                <td>${donation.companyName}</td>
                <td>${donation.Produce.toFixed(2)}</td>
                <td>${donation['Frozen Meats'].toFixed(2)}</td>
                <td>${donation.temperature || ''}</td>
                <td>${donation['Misc Frozen'].toFixed(2)}</td>
                <td>${donation.Bakery.toFixed(2)}</td>
                <td>${donation.Dry.toFixed(2)}</td>
                <td><button data-idx="${idx}" class="delete-btn">Delete</button></td>
            `;
            tableBody.appendChild(tr);
        });
    }

    if (orderToggleBtn) {
        orderToggleBtn.addEventListener('click', function() {
            isDescending = !isDescending;
            orderToggleBtn.textContent = 'Order: ' + (isDescending ? 'Descending' : 'Ascending');
            loadDonations();
        });
    }

    tableBody.addEventListener('click', function(e) {
        if (e.target.classList.contains('delete-btn')) {
            const idx = parseInt(e.target.getAttribute('data-idx'));
            let donations = getDonations();
            donations.splice(idx, 1);
            setDonations(donations);
            loadDonations();
        }
    });

    loadDonations();
});
