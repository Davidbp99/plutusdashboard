// app.js

let allGiftCards = [];

function getCountryName(code) {
  try {
    const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });
    return COUNTRY_NAMES.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

function populateFilters(data) {
  const countries = new Set();
  const categories = new Set();

  data.forEach(card => {
    card.countries.forEach(c => countries.add(c));
    card.categories.forEach(cat => categories.add(cat));
  });

  const countrySelect = document.getElementById("countryFilter");
  countrySelect.innerHTML = '<option value="">All Countries</option>';
  countries.forEach(c => {
    const option = document.createElement("option");
    option.value = c;
    option.textContent = getCountryName(c);
    countrySelect.appendChild(option);
  });

  const catSelect = document.getElementById("categoryDropdown");
  catSelect.innerHTML = "";
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    catSelect.appendChild(option);
  });
}

function applyFilters() {
  const country = document.getElementById("countryFilter").value;
  const catSelect = document.getElementById("categoryDropdown");
  const selectedCats = Array.from(catSelect.selectedOptions).map(opt => opt.value);
  const amountRange = document.getElementById("amountFilter").value;
  const searchTerm = document.getElementById("searchFilter").value.trim().toLowerCase();

  let minAmount = 0, maxAmount = Infinity;
  if (amountRange) {
    const [minStr, maxStr] = amountRange.split("-");
    minAmount = parseFloat(minStr);
    maxAmount = parseFloat(maxStr);
  }

  const filtered = allGiftCards.filter(card => {
    const countryMatch = !country || card.countries.includes(country);
    const categoryMatch = selectedCats.length === 0 || selectedCats.some(cat => card.categories.includes(cat));
    const denomMatch = (card.denominations || []).some(val => val >= minAmount && val <= maxAmount);
    const nameMatch = !searchTerm || card.name.toLowerCase().includes(searchTerm);
    return countryMatch && categoryMatch && denomMatch && nameMatch;
  });

  renderGiftCards(filtered);
}

function renderGiftCards(cards) {
  const container = document.getElementById("giftcardContainer");
  container.innerHTML = "";
  cards.forEach(card => {
    const col = document.createElement("div");
    col.className = "col-md-4 mb-4";
    const categories = card.categories.map(cat => `<span class='badge bg-info text-dark me-1 mb-1'>${cat}</span>`).join(" ");
    const countries = card.countries.map(getCountryName).join(", ");
    const denominations = (card.denominations || []).filter(n => !isNaN(n)).join(", ");
    const currency = card.currency_code || "";

    col.innerHTML = `
      <div class="card h-100 text-light bg-dark border-secondary">
        <img src="${sanitizeUrl(card.gift_card_url)}" class="card-img-top" alt="${card.name}" style="height: 150px; object-fit: contain; background:#1e1e1e;">
        <div class="card-body">
          <h5 class="card-title">${card.name}</h5>
          <p class="card-text mb-1"><strong>Country:</strong> ${countries}</p>
          <p class="card-text mb-1"><strong>Categories:</strong><br>${categories}</p>
          <p class="card-text mb-1"><strong>Giftcards Amounts:</strong> ${denominations} ${currency}</p>
          <p class="card-text mb-1"><strong>Discount:</strong> ${card.discount_percentage}%</p>
          <p class="card-text mb-1"><strong>Expiry:</strong> ${card.expiry || 'N/A'}</p>
        </div>
      </div>
    `;
    container.appendChild(col);
  });
}

function sanitizeUrl(url) {
  return (url || '').replace(/^"|"$/g, '').replace(/%22/g, '').trim();
}
