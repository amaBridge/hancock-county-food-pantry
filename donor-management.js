// donor-management.js
// Handles donor list browsing and updating


// For demo: use localStorage to persist donors as array of names (strings)
const DONOR_KEY = 'donorList';

function migrateToNameOnlyFormat() {
  // If old format (array of objects), convert to array of names
  const donors = localStorage.getItem(DONOR_KEY);
  if (donors) {
    const parsed = JSON.parse(donors);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null && 'name' in parsed[0]) {
      const migrated = parsed.map(obj => obj.name);
      localStorage.setItem(DONOR_KEY, JSON.stringify(migrated));
    }
  }
}

function getDonors() {
  migrateToNameOnlyFormat();
  const donors = localStorage.getItem(DONOR_KEY);
  return donors ? JSON.parse(donors) : [];
}

function setDonors(donors) {
  localStorage.setItem(DONOR_KEY, JSON.stringify(donors));
}

let sortMode = 'date-desc'; // 'date-desc', 'date-asc', 'alpha-asc', 'alpha-desc'

function renderDonorList() {
  const donorList = document.getElementById('donorList');
  donorList.innerHTML = '';
  let donors = getDonors();
  // Sorting
  if (sortMode === 'date-desc') {
    donors = donors.slice().reverse();
  } else if (sortMode === 'date-asc') {
    donors = donors.slice();
  } else if (sortMode === 'alpha-asc') {
    donors = donors.slice().sort((a, b) => a.localeCompare(b));
  } else if (sortMode === 'alpha-desc') {
    donors = donors.slice().sort((a, b) => b.localeCompare(a));
  }
  donors.forEach((donor, i) => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.gap = '0.5em';

    // Donor name input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = donor;
    nameInput.disabled = true;
    nameInput.style.background = 'transparent';
    nameInput.style.border = 'none';
    nameInput.style.fontSize = '1em';
    nameInput.style.flex = '1';
    li.appendChild(nameInput);

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => {
      nameInput.disabled = false;
      nameInput.focus();
      editBtn.style.display = 'none';
      saveBtn.style.display = 'inline';
    };
    li.appendChild(editBtn);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.display = 'none';
    saveBtn.onclick = () => {
      const newName = nameInput.value.trim();
      if (!newName) {
        alert('Donor name cannot be empty.');
        return;
      }
      // Check for duplicates
      const donors = getDonors();
      let idx = getDonorIndexFromList(i, donors);
      if (donors.some((d, j) => d.toLowerCase() === newName.toLowerCase() && j !== idx)) {
        alert('Duplicate donor name.');
        return;
      }
      donors[idx] = newName;
      setDonors(donors);
      renderDonorList();
      if (window.opener && window.opener.updateCompanyDropdown) {
        window.opener.updateCompanyDropdown();
      }
    };
    li.appendChild(saveBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => {
      if (confirm('Delete this donor?')) {
        const donors = getDonors();
        let idx = getDonorIndexFromList(i, donors);
        donors.splice(idx, 1);
        setDonors(donors);
        renderDonorList();
        if (window.opener && window.opener.updateCompanyDropdown) {
          window.opener.updateCompanyDropdown();
        }
      }
    };
    li.appendChild(deleteBtn);

    donorList.appendChild(li);
  });
}

function getDonorIndexFromList(listIdx, donors) {
  // Map listIdx to donor index based on sortMode
  if (sortMode === 'date-desc') {
    return donors.length - 1 - listIdx;
  } else if (sortMode === 'date-asc') {
    return listIdx;
  } else if (sortMode === 'alpha-asc') {
    const sorted = donors.slice().sort((a, b) => a.localeCompare(b));
    return donors.indexOf(sorted[listIdx]);
  } else if (sortMode === 'alpha-desc') {
    const sorted = donors.slice().sort((a, b) => b.localeCompare(a));
    return donors.indexOf(sorted[listIdx]);
  }
  return listIdx;
}

document.addEventListener('DOMContentLoaded', () => {
  renderDonorList();
  document.getElementById('addDonorBtn').onclick = () => {
    const input = document.getElementById('newDonorName');
    const name = input.value.trim();
    if (!name) {
      alert('Please enter a donor name.');
      return;
    }
    const donors = getDonors();
    if (donors.some(d => d.toLowerCase() === name.toLowerCase())) {
      alert('That donor already exists.');
      return;
    }
    donors.push(name);
    setDonors(donors);
    input.value = '';
    renderDonorList();
    if (window.opener && window.opener.updateCompanyDropdown) {
      window.opener.updateCompanyDropdown();
    }
  };
  // Sort buttons
  document.getElementById('sortDateDesc').onclick = () => { sortMode = 'date-desc'; localStorage.setItem('donorSortMode', sortMode); renderDonorList(); };
  document.getElementById('sortDateAsc').onclick = () => { sortMode = 'date-asc'; localStorage.setItem('donorSortMode', sortMode); renderDonorList(); };
  document.getElementById('sortAlphaAsc').onclick = () => { sortMode = 'alpha-asc'; localStorage.setItem('donorSortMode', sortMode); renderDonorList(); };
  document.getElementById('sortAlphaDesc').onclick = () => { sortMode = 'alpha-desc'; localStorage.setItem('donorSortMode', sortMode); renderDonorList(); };
  // On edit/delete, also update dropdown on home page if open
  window.updateCompanyDropdown = function() {
    // No-op here, but allows home page to call this if needed
  };
});
