let allGiftCards = [];
let versionsData = {};

const versionFiles = [
  { label: "gc_may14", date: "2024-05-14", url: "https://davidbp99.github.io/plutusdashboard/giftcardsonly/gc_may14.csv" },
  { label: "gc_may30", date: "2024-05-30", url: "https://davidbp99.github.io/plutusdashboard/giftcardsonly/gc_may30.csv" },
  { label: "gc_june03", date: "2024-06-03", url: "https://davidbp99.github.io/plutusdashboard/giftcardsonly/gc_june03.csv" },
  { label: "gc_june04", date: "2024-06-04", url: "https://davidbp99.github.io/plutusdashboard/giftcardsonly/gc_june04.csv" },
  { label: "gc_june06", date: "2024-06-06", url: "https://davidbp99.github.io/plutusdashboard/giftcardsonly/gc_june06.csv" }
];

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  await loadAllVersions();

  const latest = versionFiles.at(-1);
  allGiftCards = versionsData[latest.label];
  populateFilters(allGiftCards);
  renderGiftCards(allGiftCards);
  populateDiffDropdown();
});

function setupTabs() {
  document.getElementById("tab-main").addEventListener("click", () => {
    document.getElementById("mainView").style.display = "block";
    document.getElementById("diffView").style.display = "none";
    document.getElementById("tab-main").classList.add("active");
    document.getElementById("tab-diff").classList.remove("active");
  });

  document.getElementById("tab-diff").addEventListener("click", () => {
    document.getElementById("mainView").style.display = "none";
    document.getElementById("diffView").style.display = "block";
    document.getElementById("tab-main").classList.remove("active");
    document.getElementById("tab-diff").classList.add("active");
    renderSelectedDiff();
  });
document.getElementById("sortFilter").addEventListener("change", applyFilters);

["countryFilter", "amountFilter", "categoryDropdown", "searchFilter", "discountFilter", "sortFilter"].forEach(id => {
  document.getElementById(id).addEventListener("change", applyFilters);
});
  document.getElementById("searchFilter").addEventListener("input", applyFilters);
}

async function loadAllVersions() {
  for (const file of versionFiles) {
    const res = await fetch(file.url);
    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    versionsData[file.label] = parsed.data.map(parseCard);
  }
}

function parseCard(obj) {
  return {
    name: obj.name,
    countries: (obj.countries || '').split(';').map(s => s.trim()),
    categories: (obj.categories || '').split(';').map(s => s.trim()),
    currency_code: obj.currency,
    denominations: (obj.denominations || '').split(';').map(n => parseFloat(n.trim())).filter(n => !isNaN(n)),
    discount_percentage: obj.discount,
    expiry: obj.expiry,
    gift_card_url: obj.url
  };
}

function getCountryName(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code;
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
  const selectedCats = Array.from(document.getElementById("categoryDropdown").selectedOptions).map(opt => opt.value);
  const searchTerm = document.getElementById("searchFilter").value.trim().toLowerCase();
  const sortOption = document.getElementById("sortFilter")?.value || '';

  // Handle amount range safely
  let [minAmount, maxAmount] = [0, Infinity];
  const amountRange = document.getElementById("amountFilter").value;
  if (amountRange && amountRange.includes("-")) {
    [minAmount, maxAmount] = amountRange.split("-").map(Number);
  }

  // Handle discount range safely
  let [minDiscount, maxDiscount] = [0, 100];
  const discountRange = document.getElementById("discountFilter").value;
  if (discountRange && discountRange.includes("-")) {
    [minDiscount, maxDiscount] = discountRange.split("-").map(Number);
  }

  // Filtering logic
  let filtered = allGiftCards.filter(card => {
    const discount = parseFloat(card.discount_percentage || "0");

    const countryMatch = !country || card.countries.includes(country);
    const categoryMatch = selectedCats.length === 0 || selectedCats.some(cat => card.categories.includes(cat));
    const denomMatch = (card.denominations || []).some(val => val >= minAmount && val <= maxAmount);
    const discountMatch = discount >= minDiscount && discount <= maxDiscount;
    const nameMatch = !searchTerm || card.name.toLowerCase().includes(searchTerm);

    return countryMatch && categoryMatch && denomMatch && discountMatch && nameMatch;
  });

  // Sorting logic
  switch (sortOption) {
    case 'name-asc':
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      filtered.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'discount-desc':
      filtered.sort((a, b) => parseFloat(b.discount_percentage || 0) - parseFloat(a.discount_percentage || 0));
      break;
    case 'discount-asc':
      filtered.sort((a, b) => parseFloat(a.discount_percentage || 0) - parseFloat(b.discount_percentage || 0));
      break;
  }

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
    const denominations = (card.denominations || []).join(", ");
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

function populateDiffDropdown() {
  const selector = document.getElementById("diffVersionSelector");
  selector.innerHTML = "";

  for (let i = 0; i < versionFiles.length - 1; i++) {
    const from = versionFiles[i];
    const to = versionFiles[i + 1];
    const option = document.createElement("option");
    option.value = `${from.label}__${to.label}`;
    option.textContent = `${from.date} → ${to.date}`;
    selector.appendChild(option);
  }

  selector.addEventListener("change", renderSelectedDiff);
}

function renderSelectedDiff() {
  const container = document.getElementById("diffContainer");
  container.innerHTML = "";

  const [fromLabel, toLabel] = document.getElementById("diffVersionSelector").value.split("__");
  const fromFile = versionFiles.find(v => v.label === fromLabel);
  const toFile = versionFiles.find(v => v.label === toLabel);

  const fromMap = new Map(versionsData[fromLabel].map(card => [card.name, card]));
  const toMap = new Map(versionsData[toLabel].map(card => [card.name, card]));

  for (const [name, toCard] of toMap.entries()) {
    const fromCard = fromMap.get(name);
    if (!fromCard) {
      container.innerHTML += `<div class="alert alert-success">🆕 <strong>${name}</strong> added (${fromFile.date} → ${toFile.date})</div>`;
      continue;
    }

    const changes = [];
    if (toCard.discount_percentage !== fromCard.discount_percentage) {
      changes.push(`Discount: ${fromCard.discount_percentage}% → ${toCard.discount_percentage}%`);
    }
    if (JSON.stringify(toCard.denominations) !== JSON.stringify(fromCard.denominations)) {
      changes.push(`Amounts: [${fromCard.denominations.join(', ')}] → [${toCard.denominations.join(', ')}]`);
    }

    if (changes.length > 0) {
      container.innerHTML += `
        <div class="card bg-dark text-light border-secondary mb-3 p-3">
          <h5>${name}</h5>
          <p><strong>${fromFile.date} → ${toFile.date}</strong></p>
          ${changes.map(change => `<p class="mb-1">🔁 ${change}</p>`).join("")}
        </div>`;
    }
  }
}
