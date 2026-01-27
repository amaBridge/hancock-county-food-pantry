// ============================================================
// donor-management.js
// ============================================================
// Purpose
// - Manages the donor list (create / edit / delete) on donor-management.html.
// - Persists donors in browser localStorage under key: "donorList".
// - Notifies the Home page dropdown when this page was opened as a popup
//   (via window.opener.updateCompanyDropdown()).
//
// Data model (localStorage)
// - Current: ["Acme Inc", "Jane Doe", ...]
// - Legacy:  [{"name":"Acme Inc"}, ...]  (auto-migrated)
// ============================================================

// Storage key used by Home + Donor Management
const DONOR_KEY = 'donorList';

// Storage key for favorites (stored as lowercased names for case-insensitive matching)
const FAVORITES_KEY = 'donorFavorites';

// Storage key for UI preference: favorites pinned to top of the list
const FAVORITES_ON_TOP_KEY = 'donorFavoritesOnTop';

// ----------------------------
// Storage helpers
// ----------------------------

function migrateToNameOnlyFormat() {
  // If old format (array of objects), convert to array of strings.
  // This keeps all pages in sync (Home dropdown expects name-only).
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
  // Always normalize before reading.
  migrateToNameOnlyFormat();
  const donors = localStorage.getItem(DONOR_KEY);
  return donors ? JSON.parse(donors) : [];
}

function setDonors(donors) {
  localStorage.setItem(DONOR_KEY, JSON.stringify(donors));
}

function normalizeDonorName(name) {
  return String(name || '').trim().toLowerCase();
}

function getFavoriteSet() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.map(normalizeDonorName).filter(Boolean));
  } catch {
    return new Set();
  }
}

function setFavoriteSet(favoriteSet) {
  const arr = [...favoriteSet].filter(Boolean);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr));
}

function isFavorite(name) {
  const favorites = getFavoriteSet();
  return favorites.has(normalizeDonorName(name));
}

function toggleFavorite(name) {
  const key = normalizeDonorName(name);
  if (!key) return;
  const favorites = getFavoriteSet();
  if (favorites.has(key)) {
    favorites.delete(key);
  } else {
    favorites.add(key);
  }
  setFavoriteSet(favorites);
}

function renameFavorite(oldName, newName) {
  const oldKey = normalizeDonorName(oldName);
  const newKey = normalizeDonorName(newName);
  if (!oldKey || !newKey) return;

  const favorites = getFavoriteSet();
  if (!favorites.has(oldKey)) return;
  favorites.delete(oldKey);
  favorites.add(newKey);
  setFavoriteSet(favorites);
}

function removeFavorite(name) {
  const key = normalizeDonorName(name);
  if (!key) return;
  const favorites = getFavoriteSet();
  if (!favorites.has(key)) return;
  favorites.delete(key);
  setFavoriteSet(favorites);
}

function getFavoritesOnTopEnabled() {
  const raw = localStorage.getItem(FAVORITES_ON_TOP_KEY);
  // Default ON unless the user explicitly turns it off.
  if (raw === null) return true;
  return raw === 'true';
}

function setFavoritesOnTopEnabled(enabled) {
  localStorage.setItem(FAVORITES_ON_TOP_KEY, enabled ? 'true' : 'false');
}

function findDonorIndexByName(name, donors) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return -1;
  return donors.findIndex(d => String(d || '').trim().toLowerCase() === key);
}

// ----------------------------
// Rendering + sorting
// ----------------------------

let sortMode = 'date-desc'; // 'date-desc', 'date-asc', 'alpha-asc', 'alpha-desc'

function renderDonorList() {
  // Renders the list UI from storage, applying the current sort mode.
  const donorList = document.getElementById('donorList');
  donorList.innerHTML = '';
  let donors = getDonors();
  const favorites = getFavoriteSet();
  // Sorting (date-based modes assume insertion order reflects creation order)
  if (sortMode === 'date-desc') {
    donors = donors.slice().reverse();
  } else if (sortMode === 'date-asc') {
    donors = donors.slice();
  } else if (sortMode === 'alpha-asc') {
    donors = donors.slice().sort((a, b) => a.localeCompare(b));
  } else if (sortMode === 'alpha-desc') {
    donors = donors.slice().sort((a, b) => b.localeCompare(a));
  }

  // Optional: pin favorites to the top regardless of sort mode.
  // Implementation detail: we sort first, then stable-partition into favorites/non-favorites.
  // This keeps the user's selected sort order *within* each group.
  if (getFavoritesOnTopEnabled()) {
    const fav = [];
    const nonFav = [];
    donors.forEach(d => {
      if (favorites.has(normalizeDonorName(d))) fav.push(d);
      else nonFav.push(d);
    });
    donors = [...fav, ...nonFav];
  }

  donors.forEach((donor, i) => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.gap = '0.5em';

    // Favorite toggle (star)
    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.title = 'Favorite / Unfavorite donor';
    const favKey = normalizeDonorName(donor);
    const favOn = favorites.has(favKey);
    favBtn.className = 'favorite-toggle' + (favOn ? ' is-favorite' : '');
    favBtn.setAttribute('aria-pressed', favOn ? 'true' : 'false');
    favBtn.setAttribute('aria-label', favOn ? 'Unfavorite donor' : 'Favorite donor');
    favBtn.textContent = favOn ? '★' : '☆';
    favBtn.style.minWidth = '2.2em';
    favBtn.style.textAlign = 'center';
    favBtn.onclick = () => {
      toggleFavorite(donor);
      renderDonorList();
      if (window.opener && window.opener.updateCompanyDropdown) {
        window.opener.updateCompanyDropdown();
      }
    };
    li.appendChild(favBtn);

    // Donor name (read-only until Edit)
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
      // Toggle into edit mode
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
      // Enforce case-insensitive uniqueness
      const donors = getDonors();
      const idx = findDonorIndexByName(donor, donors);
      if (idx < 0) {
        alert('Could not find this donor in storage. Please refresh and try again.');
        renderDonorList();
        return;
      }
      if (donors.some((d, j) => d.toLowerCase() === newName.toLowerCase() && j !== idx)) {
        alert('Duplicate donor name.');
        return;
      }
      const oldName = donors[idx];
      donors[idx] = newName;
      setDonors(donors);

      // If this donor was favorited, carry the favorite flag to the new name.
      renameFavorite(oldName, newName);

      renderDonorList();

      // If Home is open (typically via popup), refresh its dropdown.
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
        const idx = findDonorIndexByName(donor, donors);
        if (idx < 0) {
          alert('Could not find this donor in storage. Please refresh and try again.');
          renderDonorList();
          return;
        }
        const deletedName = donors[idx];
        donors.splice(idx, 1);
        setDonors(donors);

        // Remove from favorites if present.
        removeFavorite(deletedName);

        renderDonorList();

        // If Home is open (typically via popup), refresh its dropdown.
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
  // Map the rendered list index back to the true array index.
  // Needed because edit/delete buttons operate on the rendered order.
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

// ----------------------------
// Page wiring (event handlers)
// ----------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Load saved sort mode (shared with Home)
  sortMode = localStorage.getItem('donorSortMode') || sortMode;

  // Wire "Favorites On Top" toggle (persisted)
  const favoritesOnTopToggle = document.getElementById('favoritesOnTopToggle');
  if (favoritesOnTopToggle) {
    // Persist the default the first time this runs.
    if (localStorage.getItem(FAVORITES_ON_TOP_KEY) === null) {
      setFavoritesOnTopEnabled(true);
    }
    favoritesOnTopToggle.checked = getFavoritesOnTopEnabled();
    favoritesOnTopToggle.addEventListener('change', () => {
      setFavoritesOnTopEnabled(!!favoritesOnTopToggle.checked);
      renderDonorList();
    });
  }

  // Initial render
  renderDonorList();

  // Add donor
  const addDonorBtn = document.getElementById('addDonorBtn');
  addDonorBtn.onclick = () => {
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

    // If Home is open (typically via popup), refresh its dropdown.
    if (window.opener && window.opener.updateCompanyDropdown) {
      window.opener.updateCompanyDropdown();
    }
  };

  // UX: pressing Enter in the input adds the donor
  const newDonorNameInput = document.getElementById('newDonorName');
  if (newDonorNameInput) {
    newDonorNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDonorBtn.click();
      }
    });
  }

  // Sort buttons
  document.getElementById('sortDateDesc').onclick = () => { sortMode = 'date-desc'; localStorage.setItem('donorSortMode', sortMode); renderDonorList(); };
  document.getElementById('sortDateAsc').onclick = () => { sortMode = 'date-asc'; localStorage.setItem('donorSortMode', sortMode); renderDonorList(); };
  document.getElementById('sortAlphaAsc').onclick = () => { sortMode = 'alpha-asc'; localStorage.setItem('donorSortMode', sortMode); renderDonorList(); };
  document.getElementById('sortAlphaDesc').onclick = () => { sortMode = 'alpha-desc'; localStorage.setItem('donorSortMode', sortMode); renderDonorList(); };

  // Expose a hook so other pages can call it if needed.
  window.updateCompanyDropdown = function() {
    // No-op here, but allows home page to call this if needed
  };
});
