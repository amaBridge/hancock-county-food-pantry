// donations-management.js
// Handles displaying and deleting donations

document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.querySelector('#donationsTable tbody');
    const orderToggleBtn = document.getElementById('orderToggleBtn');
    let isDescending = true;

    function loadDonations() {
        tableBody.innerHTML = '';
        let donations = JSON.parse(localStorage.getItem('donationsList') || '[]');
        // Sort by dateTime
        donations.sort((a, b) => {
            // Try to parse dateTime as Date
            let dateA = new Date(a.dateTime);
            let dateB = new Date(b.dateTime);
            if (isDescending) {
                return dateB - dateA;
            } else {
                return dateA - dateB;
            }
        });
        donations.forEach((donation, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${donation.dateTime}</td>
                <td>${donation.companyName}</td>
                <td>${donation.Produce.toFixed(2)}</td>
                <td>${donation['Frozen Meats'].toFixed(2)}</td>
                <td>${donation.temperature ? donation.temperature : ''}</td>
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
            if (!confirm('Are you sure you want to delete this donation?')) return;
            let donations = JSON.parse(localStorage.getItem('donationsList') || '[]');
            // Sort donations before deleting to match display order
            donations.sort((a, b) => {
                let dateA = new Date(a.dateTime);
                let dateB = new Date(b.dateTime);
                if (isDescending) {
                    return dateB - dateA;
                } else {
                    return dateA - dateB;
                }
            });
            donations.splice(idx, 1);
            localStorage.setItem('donationsList', JSON.stringify(donations));
            loadDonations();
        }
    });
    loadDonations();
});
