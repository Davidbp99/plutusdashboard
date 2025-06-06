const TOKEN_KEY = 'plutusAuthTokenEnc';
const ENCRYPTION_KEY = 'plutus-salt';
const REWARD_CACHE_KEY = 'plutusRewardRateCache';

const CRY_REWARD_LEVELS = [
    { label: "Noob", threshold: 1 },
    { label: "Researcher", threshold: 100 },
    { label: "Explorer", threshold: 200 },
    { label: "Adventurer", threshold: 500 },
    { label: "Chad", threshold: 1000 },
    { label: "Hero", threshold: 2000 },
    { label: "Veteran", threshold: 3000 },
    { label: "Legend", threshold: 10000 },
    { label: "Myth", threshold: 20000 },
    { label: "G.O.A.T", threshold: 30000 },
    { label: "Honey Badger", threshold: 40000 }
  ];
  
  function formatCurrency(amount) {
    const currency = loadCurrencyPreference();
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  }
  
let allGiftCards = [];
let giftcardVault = [];

function loadRewardRateCache() {
    const raw = localStorage.getItem(REWARD_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  }

  function removeCache() {
    localStorage.removeItem(REWARD_CACHE_KEY);
    console.log('✅ Reward rate cache cleared');
  }
  
  function saveRewardRateCache(cache) {
    localStorage.setItem(REWARD_CACHE_KEY, JSON.stringify(cache));
  }
  



  
  window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramToken = urlParams.get('token');
  
    if (paramToken) {
      // Save it encrypted
      const encrypted = CryptoJS.AES.encrypt(paramToken, ENCRYPTION_KEY).toString();
      localStorage.setItem(TOKEN_KEY, encrypted);
      document.getElementById('authToken').value = paramToken;
      document.getElementById('rememberToken').checked = true;
      console.log('✅ Token imported from URL and saved.');
    } else {
      // Fallback: load from localStorage
      const encrypted = localStorage.getItem(TOKEN_KEY);
      if (encrypted) {
        try {
          const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
          const token = bytes.toString(CryptoJS.enc.Utf8);
          if (token) {
            document.getElementById('authToken').value = token;
            document.getElementById('rememberToken').checked = true;
          }
        } catch (e) {
          console.warn('❌ Invalid token in localStorage');
        }
      }
    }
  });
  

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  document.getElementById('authToken').value = '';
  document.getElementById('rememberToken').checked = false;
  alert("Saved token cleared.");
}

async function fetchData() {
    const token = document.getElementById("authToken").value.trim();
    const limit = document.getElementById("limit").value.trim();
    const remember = document.getElementById("rememberToken").checked;
  
    if (!token || !limit || isNaN(limit)) {
      alert("Enter a valid token and limit.");
      return;
    }
  
    if (remember) {
      const encrypted = CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();
      localStorage.setItem(TOKEN_KEY, encrypted);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  
    const apiUrl = `https://api.plutus.it/v3/rewards/list?limit=${limit}`;
  
    try {
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
        referrer: "https://app.plutus.it",
        referrerPolicy: "strict-origin-when-cross-origin",
        mode: "cors",
      });
  
      const data = await response.json();
      const rewards = Array.isArray(data.data) ? data.data : [];
  
      const rewardRateMap = new Map();
      rewards.forEach(r => {
        if (r.transactionDescription && r.rewardRate && r.createdAt) {
          const key = `${r.transactionDescription.trim()}|${new Date(r.createdAt).getTime()}|${r.transactionOriginalId || ''}`;
          rewardRateMap.set(key, r.rewardRate);
        }
      });
      window.lastFetchedRewards = rewards;

      renderRewardsTable(rewards);
      applyRewardFilter();
      renderForecast(rewards);
      fetchGiftCards(token);
      fetchGiftCardVault(token);
      fetchTransactions(token, limit, rewardRateMap);
      const [crySummary, subscription, wallets] = await Promise.all([
        fetchCrySummary(token),
        fetchSubscriptionInfo(token),
        fetchStakingWallets(token)
      ]);
      
      const perks = await fetchPerks(token);
      window.lastFetchedUserData = { crySummary, subscription, wallets, perks };
      renderUserSettings(crySummary, subscription, wallets);
      renderPerksTab(perks);  
      

      
      

  
    } catch (error) {
      console.error("Fetch error:", error);
      alert("An error occurred while fetching data.");
    }
  }
  

  function renderRewardsTable(rewards) {
    const tbody = document.querySelector("#rewardTable tbody");
    tbody.innerHTML = "";
  
    rewards.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
    rewards.forEach(entry => {
      const createdAt = new Date(entry.createdAt);
      const approveAt = new Date(createdAt.getTime() + 45 * 24 * 60 * 60 * 1000);
      const fiatFormatted = entry.fiatAmountRewarded ? formatCurrency(entry.fiatAmountRewarded / 100) : '-';
  
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${entry.id}</td>
        <td>${entry.ticker}</td>
        <td>${entry.amount}</td>
        <td>${fiatFormatted}</td>
        <td><span class="badge ${getStatusBadgeClass(entry.status)}">${entry.status}</span></td>
        <td>${entry.type}</td>
        <td>${entry.transactionDescription || '-'}</td>
        <td>${entry.rewardRate || '-'}</td>
        <td>${createdAt.toLocaleString()}</td>
        <td>${approveAt.toLocaleString()}</td>
      `;
      if (localStorage.getItem('devMode') === '1') {
        row.addEventListener('click', (function(entryCopy) {
          return () => showDevInspector('rewards/list', entryCopy);
        })(entry));
        row.classList.add('table-info');
      }
      
  tbody.appendChild(row);
    });
  }
  

  function applyRewardFilter() {
    const status = document.getElementById("rewardStatusFilter").value;
    if (!window.lastFetchedRewards) return;
  
    const filtered = status
      ? window.lastFetchedRewards.filter(r => r.status.toLowerCase() === status)
      : window.lastFetchedRewards;
  
    renderRewardsTable(filtered);
  }
  

  function getStatusBadgeClass(status) {
    switch (status.toLowerCase()) {
      case 'approved': return 'bg-success';
      case 'rejected': return 'bg-danger';
      case 'pending': return 'bg-warning text-dark';
      default: return 'bg-secondary';
    }
  }
  

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async function fetchRewardRateForTransaction(token, transactionId, transactionDate) {
    const cell = document.getElementById(`rewardRate-${transactionId}`);
    if (!cell) return;
  
    const cache = loadRewardRateCache();
    const cached = cache[transactionId];
    const txDate = new Date(transactionDate).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
  
    // Clear old-format cache that lacks date or is outdated
    if (cached && (!cached.date || cached.date !== txDate)) {
      delete cache[transactionId];
    }
  
    if (cached && cached.date === txDate) {
      cell.innerText = cached.rate;
      return;
    }
  
    try {
      const res = await fetch(`https://api.plutus.it/v3/rewards/summary/card-transaction/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        referrer: "https://app.plutus.it",
        referrerPolicy: "strict-origin-when-cross-origin",
        mode: "cors",
      });
  
      if (!res.ok) {
        console.warn(`Reward fetch failed for ${transactionId}: ${res.status}`);
        cell.innerText = '--';
        return;
      }
  
      const json = await res.json();
      let raw = json?.percentageRewardRate ?? null;
      let rate = (!raw || raw === "0") ? '--' : `${raw}%`;
      let isDouble = false;
  
      if (raw && json.doubleRewardAmount && parseFloat(json.doubleRewardAmount) > 0) {
        const doubled = parseFloat(raw) * 2;
        rate = `${doubled.toFixed(2)}%`;
        isDouble = true;
      }
  
      cache[transactionId] = { rate, date: txDate, isDouble };
      saveRewardRateCache(cache);
  
      cell.innerText = rate;
    } catch (err) {
      console.error(`Fetch error for ${transactionId}`, err);
      cell.innerText = '--';
    }
  } 
  
  
  
  

async function fetchTransactions(token, limit) {
  if (!token || !limit || isNaN(limit)) {
    alert("Enter a valid token and limit.");
    return;
  }

  const url = `https://api.plutus.it/v3/statement/list?limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      referrer: "https://app.plutus.it",
      referrerPolicy: "strict-origin-when-cross-origin",
      mode: "cors",
    });

    const json = await res.json();
    const transactions = Array.isArray(json.data) ? json.data : [];
    window.lastFetchedTransactions = transactions;
    renderSpendingTab(transactions);

    const tbody = document.querySelector("#transactionTable tbody");
    tbody.innerHTML = "";

    const formatDate = (isoString) => {
      const d = new Date(isoString);
      const date = d.toISOString().slice(0, 10);
      const time = d.toTimeString().slice(0, 5);
      return `${date} @ ${time}`;
    };

    const getDescription = (tx) => {
      const base = tx.cleanDescription ||
        (tx.type === 'DEPOSIT_FUNDS_RECEIVED' ? 'Deposit' :
         tx.type === 'PAYIN' ? 'Inbound Transfer' :
         'Unknown');
      return `${base}<br><span class=\"text-info small\">${formatDate(tx.date)}</span>`;
    };

    const getMCC = (tx) => {
      return tx.mcc ? tx.mcc : (tx.type === 'PAYOUT' ? 'N/A' : '');
    };

    const pendingRewardRateFetches = [];
    const cache = loadRewardRateCache();

    transactions.forEach(tx => {
      const isRefund = tx.type === 'PAYOUT' && tx.isDebit === false;
      const txType = isRefund ? 'REFUND' : tx.type;

      const row = document.createElement("tr");
      tx.__source = 'statement/list'; 

if (localStorage.getItem('devMode') === '1') {
  const rewardData = cache[tx.id] || { note: 'No reward data found in cache.' };
  row.addEventListener('click', (function(txCopy, rewardCopy) {
    return () => showDevInspector('statement/list + cached reward rate (rewards/summary/card-transaction)', {
      transaction: txCopy,
      rewardRateFromCache: rewardCopy
    });
  })(tx, rewardData));
  row.classList.add('table-primary');
}

      
      
      row.innerHTML = `
        <td>${getDescription(tx)}</td>
        <td>${getMCC(tx)}</td>
        <td>${txType}</td>
        <td>${tx.status || '—'}</td>
        <td>${formatCurrency(parseFloat(tx.amount))}</td>
        <td>${tx.originalTransactionId || '—'}</td>
        <td>${parseFloat(tx.totalPluAmount || 0).toFixed(4)}</td>
        <td id=\"rewardRate-${tx.id}\">Loading...</td>
      `;

      if (txType === 'DEPOSIT_FUNDS_RECEIVED' || txType === 'PAYIN' || txType === 'PLUTUS_WALLET_GIFTCARD_SWAP_FEE' || txType === 'PLUTUS_WALLET_WITHDRAW_FEE' || txType === 'ASI' || txType === 'AUTHORISATION'  ) {
        row.classList.add("table-success");
        const cell = row.querySelector(`#rewardRate-${tx.id}`);
        if (cell) cell.innerText = '--';
      } else if (isRefund) {
        row.classList.add("table-warning");
      }

      tbody.appendChild(row);

      if (txType !== 'DEPOSIT_FUNDS_RECEIVED' && txType !== 'PAYIN' && txType !== "PLUTUS_WALLET_GIFTCARD_SWAP_FEE" && txType !== "PLUTUS_WALLET_WITHDRAW_FEE" && txType !== 'ASI' && txType !== 'AUTHORISATION' ) {
        if (isRewardRateFresh(tx.id, tx.date, cache)) {
          const cell = document.getElementById(`rewardRate-${tx.id}`);
          if (cell) cell.innerText = cache[tx.id].rate;
        } else {
          pendingRewardRateFetches.push({ id: tx.id, date: tx.date });
        }
      }
    });
    
    await fetchRewardRatesWithThrottle(token, pendingRewardRateFetches, 300);
   


  } catch (err) {
    console.error("Transaction fetch error:", err);
    alert("Failed to fetch transactions.");
  }
}

async function fetchRewardRatesWithThrottle(token, transactions, delayMs = 300) {
  for (const tx of transactions) {
    await fetchRewardRateForTransaction(token, tx.id, tx.date);
    await delay(delayMs);
  }
}



  

function renderForecast(rewards) {
  const forecastMap = new Map();
  let totalPending = 0;
  const now = new Date();
  const futureMonths = 6;

  rewards.forEach(entry => {
    const ticker = entry.ticker;
    if ((ticker === 'PLU' || ticker === 'PLUS') && entry.status === 'pending') {
      const approvalDate = new Date(entry.createdAt);
      approvalDate.setDate(approvalDate.getDate() + 45);
      const amount = parseFloat(entry.amount || 0);
      if (!isNaN(amount)) {
        totalPending += amount;
        const key = `${approvalDate.getFullYear()}-${String(approvalDate.getMonth() + 1).padStart(2, '0')}`;
        forecastMap.set(key, (forecastMap.get(key) || 0) + amount);
      }
    }
  });

  const forecastTbody = document.querySelector("#forecastTable tbody");
  forecastTbody.innerHTML = "";

  for (let i = 0; i < futureMonths; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    const amount = forecastMap.get(key) || 0;
    forecastTbody.innerHTML += `<tr><td>${label}</td><td>${amount.toFixed(4)}</td></tr>`;
  }

  forecastTbody.innerHTML += `<tr><td><strong>Total Forecasted Pending (PLUS)</strong></td><td><strong>${totalPending.toFixed(4)}</strong></td></tr>`;
}

async function fetchGiftCards(token) {
  const url = "https://api.plutus.it/v3/giftcard/brands";
  const container = document.getElementById("giftcardContainer");
  container.innerHTML = "";

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      referrer: "https://app.plutus.it",
      referrerPolicy: "strict-origin-when-cross-origin",
      mode: "cors",
    });
    const json = await res.json();
    allGiftCards = json.data || [];
    populateFilters(allGiftCards);
    renderGiftCards(allGiftCards);
  } catch (err) {
    console.error("Gift card load error", err);
    container.innerHTML = `<p class='text-danger'>Error loading gift cards.</p>`;
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
  countries.forEach(c => {
    const option = document.createElement("option");
    option.value = c;
    option.textContent = getCountryName(c);
    countrySelect.appendChild(option);
  });

  const catFilterBox = document.getElementById("categoryFilters");
  categories.forEach(cat => {
    const div = document.createElement("div");
    div.className = "form-check form-check-inline";
    div.innerHTML = `
      <input class="form-check-input" type="checkbox" value="${cat}" id="cat-${cat}">
      <label class="form-check-label" for="cat-${cat}">${cat}</label>
    `;
    catFilterBox.appendChild(div);
  });


  countrySelect.addEventListener("change", applyFilters);
  catFilterBox.addEventListener("change", applyFilters);
  document.getElementById("vaultOnlyToggle").addEventListener("change", toggleVaultView);
  document.getElementById("amountFilter").addEventListener("change", applyFilters);
  document.getElementById("searchFilter").addEventListener("input", applyFilters);
  document.getElementById("discountFilter").addEventListener("change", applyFilters);


}

function applyFilters() {
  const country = document.getElementById("countryFilter").value;
  const selectedCats = Array.from(document.querySelectorAll("#categoryFilters input:checked")).map(el => el.value);
  const showVault = document.getElementById("vaultOnlyToggle").checked;
  const amountRange = document.getElementById("amountFilter").value;
  const searchTerm = document.getElementById("searchFilter").value.trim().toLowerCase();
  const discountRange = document.getElementById("discountFilter").value;
  const sortOption = document.getElementById("giftcardSort")?.value || '';

  let [minAmount, maxAmount] = [0, Infinity];
  if (amountRange) {
    [minAmount, maxAmount] = amountRange.split("-").map(parseFloat);
  }

  let [minDiscount, maxDiscount] = [0, Infinity];
  if (discountRange) {
    [minDiscount, maxDiscount] = discountRange.split("-").map(parseFloat);
  }

  const filterFunc = (card) => {
    const countryMatch = !country || card.countries.includes(country);
    const categoryMatch = selectedCats.length === 0 || selectedCats.some(cat => card.categories.includes(cat));
    const denomMatch = !card.denominations || card.denominations.length === 0
  ? true
  : card.denominations.some(val => val >= minAmount && val <= maxAmount);

    const discount = parseFloat(card.discount_percentage || 0);
    const discountMatch = discount >= minDiscount && discount <= maxDiscount;
    const nameMatch = !searchTerm || card.name.toLowerCase().includes(searchTerm);

    return countryMatch && categoryMatch && denomMatch && discountMatch && nameMatch;
  };

  let filtered = (showVault ? giftcardVault.map(g => g.brand) : allGiftCards).filter(filterFunc);

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
    default:
      filtered.sort((a, b) => Math.max(...(b.denominations || [0])) - Math.max(...(a.denominations || [0])));
      break;
  }

  showVault
    ? renderVaultCards(giftcardVault.filter(entry => filterFunc(entry.brand)))
    : renderGiftCards(filtered);
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
          <img src="${card.gift_card_url}" class="card-img-top" alt="${card.name}" style="height: 150px; object-fit: contain; background:#1e1e1e;">
          <div class="card-body">
            <h5 class="card-title">${card.name}</h5>
            <p class="card-text mb-1"><strong>Country:</strong> ${countries}</p>
            <p class="card-text mb-1"><strong>Categories:</strong><br>${categories}</p>
            <p class="card-text mb-1"><strong>Giftcards Amounts:</strong> ${denominations || 'N/A'} ${currency}</p>
            <p class="card-text mb-1"><strong>Discount:</strong> ${card.discount_percentage}%</p>
            <p class="card-text mb-1"><strong>Expiry:</strong> ${card.expiry || 'N/A'}</p>
          </div>
        </div>
      `;
      container.appendChild(col);
    });
  }
  

async function fetchGiftCardVault(token) {
  const container = document.getElementById("giftcardVaultContainer");
  container.innerHTML = "Loading...";

  try {
    const res = await fetch("https://api.plutus.it/v3/giftcard/orders/", {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      referrer: "https://app.plutus.it",
      referrerPolicy: "strict-origin-when-cross-origin",
      mode: "cors",
    });

    const json = await res.json();
    giftcardVault = json.data || [];
    renderVaultCards(giftcardVault);
  } catch (err) {
    console.error("Vault fetch error", err);
    container.innerHTML = `<p class='text-danger'>Error loading giftcard vault.</p>`;
  }
}

// existing code up to renderVaultCards()

function renderVaultCards(cards) {
    const container = document.getElementById("giftcardVaultContainer");
    container.innerHTML = "";
  
    if (!cards.length) {
      container.innerHTML = '<p class="text-muted">No gift card orders found.</p>';
      return;
    }
  
    cards.forEach(entry => {
      const card = entry.brand;
      const cardBlock = document.createElement("div");
      cardBlock.className = "col-md-6 col-lg-4 mb-4";
      cardBlock.innerHTML = `
        <div class="card h-100 bg-dark text-light">
          <img src="${card.gift_card_url}" class="card-img-top" style="object-fit: contain; height: 160px; background: #1e1e1e;">
          <div class="card-body">
            <h5 class="card-title">${card.name}</h5>
            <p class="card-text mb-1"><strong>Status:</strong> ${entry.order_status}</p>
            <p class="card-text mb-1"><strong>Value:</strong> €${entry.giftcard_value}</p>
            <p class="card-text mb-1"><strong>Created:</strong> ${new Date(entry.created_at).toLocaleString()}</p>
            <p class="card-text mb-1"><strong>Expires:</strong> ${entry.giftcard_expiration ? new Date(entry.giftcard_expiration).toLocaleDateString() : 'N/A'}</p>
            <p class="card-text mb-1"><strong>Used:</strong> <span id="used-status-${entry.id}">${entry.used ? 'Yes' : 'No'}</span></p>
            ${entry.giftcard_url ? `<a href="${entry.giftcard_url}" class="btn btn-sm btn-primary mt-2" target="_blank">View Gift Card</a>` : ''}
            <button class="btn btn-sm btn-outline-${entry.used ? 'warning' : 'success'} mt-2" onclick="toggleUsedStatus('${entry.id}', ${!entry.used})">
              Mark as ${entry.used ? 'Active' : 'Used'}
            </button>
          </div>
        </div>
      `;
      container.appendChild(cardBlock);
    });
  }
  
  function toggleUsedStatus(id, newStatus) {
    const token = document.getElementById("authToken").value.trim();
    if (!token) {
      alert("Missing token.");
      return;
    }
  
    fetch(`https://api.plutus.it/v3/giftcard/orders/${id}/mark-used`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "referrer": "https://app.plutus.it",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "mode": "cors",
      },
      body: JSON.stringify({ used: newStatus })
    })
      .then(response => {
        if (!response.ok) {
          return response.text().then(err => {
            throw new Error(`Server error: ${response.status} ${err}`);
          });
        }
        return response.json();
      })
      .then(data => {
        console.log("✅ Updated usage status:", data);
        fetchGiftCardVault(token);
      })
      .catch(error => {
        console.error("❌ Error:", error);
        alert("Failed to update usage status.");
      });
  }
  

function toggleVaultView() {
    const isChecked = document.getElementById("vaultOnlyToggle").checked;
    document.getElementById("giftcardContainer").style.display = isChecked ? "none" : "flex";
    document.getElementById("giftcardVaultContainer").style.display = isChecked ? "flex" : "none";
    applyFilters();
  }



 


  function isRewardRateFresh(transactionId, transactionDate, cache) {
    const cached = cache[transactionId];
    const today = new Date().toISOString().slice(0, 10);
    const txDate = new Date(transactionDate).toISOString().slice(0, 10);
    return cached && cached.date !== today;
  }
  


  

 
  
  

  async function fetchCrySummary(token) {
    try {
      const res = await fetch("https://api.plutus.it/v3/cry/ledger/summary", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        },
        referrer: "https://app.plutus.it",
        referrerPolicy: "strict-origin-when-cross-origin",
        mode: "cors",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch (err) {
      console.error("CRY fetch error", err);
      return null;
    }
  }
  
  function renderUserSettings(summary, subscription = null, wallets = [], perksData = null) {
    // Summary Tab
    const summaryEl = document.getElementById("summaryContainer");
    if (summaryEl) {
      summaryEl.innerHTML = "";
      if (summary) {
        const total = parseFloat(summary.totalBalance);
        const reward = parseFloat(summary.availableReward);
        const rate = parseInt(summary.cryRate);
  
        let level = CRY_REWARD_LEVELS[0].label;
        for (const tier of CRY_REWARD_LEVELS) {
          if (total >= tier.threshold) level = tier.label;
          else break;
        }
  
        const summaryCard = document.createElement('div');
        summaryCard.className = "col-md-6";
        summaryCard.innerHTML = `
          <div class="card bg-dark text-light border-secondary">
            <div class="card-body">
              <h5 class="card-title">User Summary</h5>
              <p class="card-text mb-1"><strong>Total PLU:</strong> ${total.toFixed(2)}</p>
              <p class="card-text mb-1"><strong>CRY Rewards:</strong> ${reward.toFixed(2)} CRY</p>
              <p class="card-text mb-1"><strong>Reward Level:</strong> <span class="badge bg-info text-dark">${level}</span></p>
              <p class="card-text mb-3"><strong>CRY Rate:</strong> ${rate}</p>
              <div class="mb-2">
                <label for="currencySelect"><strong>Preferred Currency</strong></label>
                <select id="currencySelect" class="form-select" onchange="saveCurrencyPreference()">
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          </div>
        `;
        
        if (localStorage.getItem('devMode') === '1') {
          summaryCard.addEventListener('click', () => showDevInspector('user-summary', summary));
          summaryCard.classList.add('table-info');
        }
        
        summaryEl.appendChild(summaryCard);
      } else {
        summaryEl.innerHTML = `<p class="text-danger">No summary data available.</p>`;
      }
    }
  
    // Wallets Tab

const walletsEl = document.getElementById("walletsContainer");
if (walletsEl) {
  walletsEl.innerHTML = '';

  if (!wallets.length) {
    walletsEl.innerHTML = `<p class="text-muted">No wallets found.</p>`;
  } else {
    wallets.forEach(w => {
      const card = document.createElement('div');
      card.className = "col-md-6 mb-3";
      card.innerHTML = `
        <div class="card bg-secondary text-light border-light">
          <div class="card-body d-flex justify-content-between align-items-center">
            <div>
              <strong>Wallet:</strong> <code>${w.address.slice(0, 6)}...${w.address.slice(-4)}</code><br>
              <strong>Balance:</strong> ${parseFloat(w.balance).toFixed(4)} PLU
            </div>
            <a href="https://etherscan.io/address/${w.address}" target="_blank" class="btn btn-outline-info btn-sm">View</a>
          </div>
        </div>
      `;

      if (localStorage.getItem('devMode') === '1') {
        card.addEventListener('click', () => showDevInspector('staking-wallet', w));
        card.classList.add('table-info');
      }

      walletsEl.appendChild(card);
    });
  }
}

  
// Subscription Tab
const subEl = document.getElementById("subscriptionContainer");
if (subEl) {
  subEl.innerHTML = '';

  if (subscription) {
    const card = document.createElement('div');
    card.className = "col-md-6";
    card.innerHTML = `
      <div class="card bg-secondary text-light border-light">
        <div class="card-body">
          <h5 class="card-title">Subscription</h5>
          <p><strong>Plan:</strong> ${subscription.plan}</p>
          <p><strong>Billing:</strong> ${subscription.billingCycle}</p>
          <p><strong>Start:</strong> ${new Date(subscription.start).toLocaleDateString()}</p>
          <p><strong>End:</strong> ${new Date(subscription.end).toLocaleDateString()}</p>
        </div>
      </div>
    `;

    if (localStorage.getItem('devMode') === '1') {
      card.addEventListener('click', () => showDevInspector('subscription', subscription));
      card.classList.add('table-info');
    }

    subEl.appendChild(card);
  } else {
    subEl.innerHTML = `<p class="text-muted">No subscription data found.</p>`;
  }
}

  
    // Perks are already handled by `renderPerksTab()`
    setTimeout(() => {
      const currencyEl = document.getElementById("currencySelect");
      if (currencyEl) currencyEl.value = loadCurrencyPreference();
    }, 0);
  }
  
  
  
  
  
  async function fetchSubscriptionInfo(token) {
    try {
      const res = await fetch("https://api.plutus.it/v3/subscription", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        },
        referrer: "https://app.plutus.it",
        referrerPolicy: "strict-origin-when-cross-origin",
        mode: "cors",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("Subscription fetch error", err);
      return null;
    }
  }
  
  async function fetchStakingWallets(token) {
    try {
      const res = await fetch("https://api.plutus.it/v3/staking-wallets/list", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      });
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    } catch (err) {
      console.error("Wallet fetch error", err);
      return [];
    }
  }
  

// === RECURRING PAYMENTS DETECTION ===
const MERCHANT_PREFIXES = {
  "steam": "Steam",
  "curve": "Curve",
  "disney plus": "Disney+",
  "spotify": "Spotify",
  "openai": "OpenAI",
  "klarna": "Klarna"
};

function normalizeMerchant(name) {
  const lower = name.toLowerCase();
  for (const prefix in MERCHANT_PREFIXES) {
    if (lower.includes(prefix)) return MERCHANT_PREFIXES[prefix];
  }
  return name;
}



function detectRecurringPayments(transactions) {
  const recurringMap = new Map();
  const cleaned = transactions.filter(tx => tx.isDebit && tx.type === "PAYOUT");
  const normalized = cleaned.map(tx => ({
    ...tx,
    normalizedName: normalizeMerchant(tx.cleanDescription?.toLowerCase().trim() || ""),
    amountFloat: parseFloat(tx.amount)
  }));

  for (let tx of normalized) {
    const key = tx.normalizedName;
    if (!recurringMap.has(key)) recurringMap.set(key, []);
    recurringMap.get(key).push(tx);
  }

  const recurringResults = [];
  for (let [merchant, txs] of recurringMap.entries()) {
    if (!Object.values(MERCHANT_PREFIXES).includes(merchant)) continue;

    txs.sort((a, b) => new Date(a.date) - new Date(b.date));
    const intervals = txs.map((t, i) => {
      if (i === 0) return null;
      return (new Date(t.date) - new Date(txs[i - 1].date)) / (1000 * 60 * 60 * 24);
    }).filter(i => i !== null);

    const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;

    recurringResults.push({
      merchant,
      txCount: txs.length,
      totalSpent: txs.reduce((sum, t) => sum + t.amountFloat, 0),
      avgAmount: txs.reduce((sum, t) => sum + t.amountFloat, 0) / txs.length,
      avgInterval,
      txs
    });
  }

  return recurringResults;
}

// === CATEGORY BREAKDOWN ===
const MCC_TO_CATEGORY = {
  "5411": "Groceries",
  "5814": "Fast Food",
  "5816": "Entertainment",
  "4899": "Streaming Services",
  "5999": "Retail",
  "4814": "Telecom",
  "8999": "Financial Services"
};

function categorizeByMCC(transactions) {
  const categoryMap = new Map();
  for (let tx of transactions) {
    if (!tx.isDebit || tx.type !== "PAYOUT") continue;
    const mcc = tx.mcc || "0000";
    const category = MCC_TO_CATEGORY[mcc] || "Other";
    const amount = parseFloat(tx.amount);
    const plu = parseFloat(tx.totalPluAmount || 0);
    if (!categoryMap.has(category)) categoryMap.set(category, { spend: 0, count: 0, plu: 0 });
    const c = categoryMap.get(category);
    c.spend += amount;
    c.count++;
    c.plu += plu;
  }
  return Array.from(categoryMap.entries()).map(([category, stats]) => ({
    category,
    ...stats,
    avgSpend: stats.spend / stats.count
  })).sort((a, b) => b.spend - a.spend);
}

// === EXPORT TO CSV ===
function generateCSV(dataArray, filename = "export.csv") {
  if (!dataArray.length) return;
  const headers = Object.keys(dataArray[0]);
  const rows = dataArray.map(obj => headers.map(key => JSON.stringify(obj[key] || "")).join(","));
  const csv = [headers.join(","), ...rows].join("");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// === RENDER TAB ===
function renderSpendingTab(transactions) {
  let recurring = detectRecurringPayments(transactions);
  const dismissedRecurring = JSON.parse(localStorage.getItem('dismissedRecurring') || '[]');
  recurring = recurring.filter(r => !dismissedRecurring.includes(r.merchant));
  const categories = categorizeByMCC(transactions);
  const container = document.getElementById("spendingContent");
  const dismissedHtml = dismissedRecurring.length ? `
    <div class="mb-3">
      <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#dismissedList" aria-expanded="false">
        Restore Dismissed Merchants
      </button>
      <div class="collapse mt-2" id="dismissedList">
        ${dismissedRecurring.map(m => `<button class="btn btn-sm btn-outline-success me-2 mb-1" onclick="restoreRecurring('${m}')">${m}</button>`).join(' ')}
      </div>
    </div>
  ` : '';
  window._recurringCSVData = recurring;
  window._categoriesCSVData = categories;

  container.innerHTML = dismissedHtml + `
    <h4>Recurring Payments</h4>
<button class="btn btn-sm btn-outline-light mb-2" onclick='generateCSV(window._recurringCSVData, "recurring.csv")'>Export Recurring</button>
    <table class="table table-hover">
      <thead><tr><th>Merchant</th><th>Total Spent</th><th>Tx Count</th><th>Avg Amount</th><th>Avg Interval (days)</th></tr></thead>
      <tbody>
        ${recurring.map(r => `<tr><td>${r.merchant} <button class='btn btn-sm btn-outline-danger ms-2' onclick='dismissRecurring("${r.merchant}")'>X</button></td><td>${formatCurrency(r.totalSpent)}</td><td>${r.txCount}</td><td>${formatCurrency(r.avgAmount)}</td><td>${r.avgInterval.toFixed(1)}</td></tr>`).join('')}
      </tbody>
    </table>
    <h4 class="mt-4">Category Breakdown</h4>
<button class="btn btn-sm btn-outline-light mb-2" onclick='generateCSV(window._categoriesCSVData, "categories.csv")'>Export Categories</button>
    <table class="table table-hover">
      <thead><tr><th>Category</th><th>Total Spent</th><th>Tx Count</th><th>Avg Spend</th><th>Total PLU</th></tr></thead>
      <tbody>
        ${categories.map(c => `<tr><td>${c.category}</td><td>${formatCurrency(c.spend)}</td><td>${c.count}</td><td>${formatCurrency(c.avgSpend)}</td><td>${c.plu.toFixed(4)}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}
function dismissRecurring(merchant) {
  const dismissed = JSON.parse(localStorage.getItem('dismissedRecurring') || '[]');
  if (!dismissed.includes(merchant)) dismissed.push(merchant);
  localStorage.setItem('dismissedRecurring', JSON.stringify(dismissed));

  const row = document.querySelector(`button[onclick='dismissRecurring("${merchant}")']`)?.closest('tr');
  if (row) row.remove();
  if (window.lastFetchedTransactions) {
    renderSpendingTab(window.lastFetchedTransactions);
  }

  const dismissedList = document.getElementById("dismissedList");
  if (dismissedList && ![...dismissedList.children].some(btn => btn.textContent === merchant)) {
    const btn = document.createElement("button");
    btn.className = "btn btn-sm btn-outline-success me-2 mb-1";
    btn.setAttribute("onclick", `restoreRecurring('${merchant}')`);
    btn.textContent = merchant;
    dismissedList.appendChild(btn);

  }
}

function restoreRecurring(merchant) {
  const dismissed = JSON.parse(localStorage.getItem('dismissedRecurring') || '[]');
  const updated = dismissed.filter(m => m !== merchant);
  localStorage.setItem('dismissedRecurring', JSON.stringify(updated));

  const restoreButton = document.querySelector(`#dismissedList button[onclick="restoreRecurring('${merchant}')"]`);
  if (restoreButton) restoreButton.remove();

  // Live re-render the entire spending tab
  if (window.lastFetchedTransactions) {
    renderSpendingTab(window.lastFetchedTransactions);
  }
}


const CURRENCY_PREF_KEY = 'preferredCurrency';

function saveCurrencyPreference() {
  const selected = document.getElementById("currencySelect").value;
  localStorage.setItem(CURRENCY_PREF_KEY, selected);

  // Re-render transactions and spending tab with new currency
  if (window.lastFetchedTransactions) {
    fetchTransactions(document.getElementById("authToken").value.trim(), document.getElementById("limit").value.trim());
  }
  if (window.lastFetchedRewards) {
    renderRewardsTable(window.lastFetchedRewards);
  }
  
}


function loadCurrencyPreference() {
  return localStorage.getItem(CURRENCY_PREF_KEY) || 'EUR';
}



window.DevMode = function (enable) {
  localStorage.setItem('devMode', enable ? '1' : '0');
  console.log(`🔧 DevMode ${enable ? 'enabled' : 'disabled'}`);
  document.body.classList.toggle('devmode-active', enable);

  const token = document.getElementById("authToken").value.trim();
  const limit = document.getElementById("limit").value.trim();

  document.getElementById('exportGiftcardsDev')?.classList.toggle('d-none', !enable);
  document.getElementById('rerenderUserSettingsBtn')?.classList.toggle('d-none', !enable);

  if (token && limit) {
    if (window.lastFetchedRewards) renderRewardsTable(window.lastFetchedRewards);
    if (window.lastFetchedTransactions) fetchTransactions(token, limit);
    if (window.lastFetchedUserData) {
      renderUserSettings(
        window.lastFetchedUserData.crySummary,
        window.lastFetchedUserData.subscription,
        window.lastFetchedUserData.wallets
      );
    }
  }
};



window.showDevInspector = function (source, data) {
  const modal = new bootstrap.Modal(document.getElementById('devInspectorModal'));
  const content = document.getElementById('devInspectorContent');
  content.textContent = `📦 Source: ${source}\n\n${JSON.stringify(data, null, 2)}`;
  modal.show();
};


/*
Dev notes. Feel free to use these if you now found this.

-- Pull full api call for a row
DevMode(true);
DevMode(false);
console.log(document.body.classList.contains('devmode-active')); 
*/


function exportAllGiftcardsToCSV() {
  if (!Array.isArray(allGiftCards) || allGiftCards.length === 0) {
    alert("No gift cards loaded.");
    return;
  }

  const csvData = allGiftCards.map(card => ({
    name: card.name,
    countries: (card.countries || []).join("; "),
    categories: (card.categories || []).join("; "),
    currency: card.currency_code || '',
    denominations: (card.denominations || []).join("; "),
    discount: card.discount_percentage,
    expiry: card.expiry || 'N/A',
    url: card.gift_card_url.replace(/^"|"$/g, '') 
  }));


  const headers = Object.keys(csvData[0]);
  const rows = csvData.map(obj => headers.map(h => {
    const value = (obj[h] || '').toString().replace(/"/g, '""');
    return '"' + value + '"';
  }).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gc.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


// legal notice
window.addEventListener('DOMContentLoaded', () => {
  const trigger = document.querySelector('button[data-bs-target="#howtoPane"]');
  if (trigger) trigger.click();

  if (!localStorage.getItem("plutusNoticeAcceptedNew")) {
    const legalModal = new bootstrap.Modal(document.getElementById('legalNoticeModal'));
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmAcceptModal'));

    legalModal.show();

    document.getElementById("acceptLegalNotice").addEventListener("click", () => {
      confirmModal.show();
    });

    document.getElementById("rejectLegalNotice").addEventListener("click", () => {
      window.location.href = "https://www.google.com";
    });

    document.getElementById("confirmAccept").addEventListener("click", () => {
      localStorage.setItem("plutusNoticeAcceptedNew", "1");
      confirmModal.hide();
      legalModal.hide();
    });

    document.getElementById("confirmReject").addEventListener("click", () => {
      confirmModal.hide();
    });
  }
});

let perkSelectorState = {
  perks: [],
  selected: [],
  favorites: JSON.parse(localStorage.getItem('perkFavorites') || '[]'),
  mode: 'current',
  limit: 0,
  stackingTokens: 0,
  categories: []
};
function switchPerkSelectorMode() {
  const isNext = perkSelectorState.mode === 'current';

  // Toggle mode
  perkSelectorState.mode = isNext ? 'next' : 'current';

  // Recalculate perks based on mode
  const perksData = window.lastFetchedUserData?.perks;
  if (!perksData) return;

  const selectedPerks = isNext ? perksData.nextMonthPerks : perksData.currentMonthPerks;
  const limit = perksData.perksLimit || 0;
  const stacking = perksData.stackingTokensCount || 0;

  // Flatten selected perk IDs (can have duplicates due to stacking)
  perkSelectorState.selected = selectedPerks.map(p => p.id);
  perkSelectorState.limit = limit;
  perkSelectorState.stackingTokens = stacking;

  renderPerkSelectorModal();
}


function openPerkSelector(mode = 'current') {
  const token = document.getElementById("authToken").value.trim();
  if (!token) return alert("Missing token");
  perkSelectorState.mode = mode;

  fetch("https://api.plutus.it/v3/perks/page-data", {
    headers: { Authorization: `Bearer ${token}` },
    referrer: "https://app.plutus.it",
    referrerPolicy: "strict-origin-when-cross-origin",
    mode: "cors",
  })
    .then(res => res.json())
    .then(data => {
      perkSelectorState.limit = data.perksLimit;
      perkSelectorState.stackingTokens = data.stackingTokensCount || 0;
      perkSelectorState.selected = (mode === 'next' ? data.nextMonthPerks : data.currentMonthPerks).map(p => p.id);

      return fetch(`https://api.plutus.it/v3/perks?term=${mode}`, {
        headers: { Authorization: `Bearer ${token}` },
        referrer: "https://app.plutus.it",
        referrerPolicy: "strict-origin-when-cross-origin",
        mode: "cors",
      });
    })
    .then(res => res.json())
    .then(json => {
      perkSelectorState.perks = json.perks || [];
      perkSelectorState.categories = [...new Set(json.perks.map(p => p.category).filter(Boolean))];
      renderPerkSelectorModal();
      new bootstrap.Modal(document.getElementById("perkSelectorModal")).show();
    })
    .catch(err => {
      console.error("Perk fetch failed", err);
      alert("Failed to load perks");
    });
}

function renderPerkSelectorModal() {
  const modalBody = document.getElementById("perkSelectorModalBody");
  const search = document.getElementById("perkSearchInput").value.trim().toLowerCase();
  const catFilter = document.getElementById("perkCategoryFilter")?.value || '';
  const favOnly = catFilter === 'Favorites';

  const perks = perkSelectorState.perks.filter(p => {
    const matchSearch = p.label.toLowerCase().includes(search);
    const matchFav = favOnly ? perkSelectorState.favorites.includes(p.id) : true;
    const matchCat = catFilter && !favOnly ? p.category === catFilter : true;
    return matchSearch && matchFav && matchCat;
  });

  // Set month names in English
  const now = new Date();
  const currentMonth = now.toLocaleString('en-US', { month: 'long' });
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1).toLocaleString('en-US', { month: 'long' });

  const monthLabel = perkSelectorState.mode === 'current'
    ? `${currentMonth} (Current Month)`
    : `${nextMonth} (Next Month)`;

  // Set modal title
  document.getElementById('perkSelectorTitle').innerHTML =
  `Select Your Perks — <strong>${monthLabel}</strong> (<span id="perkSelectorLimitDisplay">${perkSelectorState.selected.length}/${perkSelectorState.limit}</span>)`;


  // Rebuild category filters if not already populated
  const categorySelect = document.getElementById("perkCategoryFilter");
  if (categorySelect && categorySelect.options.length <= 1) {
    categorySelect.innerHTML = `<option value="">All</option><option value="Favorites">★ Favorites</option>` +
      perkSelectorState.categories.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  // Reset modal body and add month switcher
  modalBody.innerHTML = '';
  const switchBtn = document.createElement('div');
  switchBtn.className = "d-flex justify-content-between align-items-center mb-3";
  switchBtn.innerHTML = `
    <h5 class="mb-0">${monthLabel}</h5>
    <button class="btn btn-sm btn-outline-info" onclick="switchPerkSelectorMode()">
      Switch to ${perkSelectorState.mode === 'current' ? 'Next Month' : 'Current Month'}
    </button>
  `;
  modalBody.appendChild(switchBtn);

  // Render perks
  perks.forEach(p => {
    const selectedCount = perkSelectorState.selected.filter(id => id === p.id).length;
    const favorite = perkSelectorState.favorites.includes(p.id);
    const canAdd = selectedCount < 2 && (selectedCount === 0 || perkSelectorState.stackingTokens > 0);
    const canStack = selectedCount === 1 &&
                     perkSelectorState.stackingTokens > 0 &&
                     perkSelectorState.selected.length < perkSelectorState.limit;

    const div = document.createElement("div");
    div.className = "perk-item d-flex align-items-center justify-content-between border p-2 mb-1 bg-dark text-light";

    div.innerHTML = `
      <div class="d-flex align-items-center">
        <img src="${p.imageUrl}" alt="${p.label}" style="height: 30px" class="me-2">
        <div>
          <strong>${p.label}</strong><br>
          <small class="text-muted">${p.category || 'Uncategorized'}</small>
        </div>
        ${p.isBonus ? '<span class="badge bg-warning ms-2">Bonus</span>' : ''}
      </div>
      <div>
<div>
  ${selectedCount ? (
    perkSelectorState.mode === 'current'
      ? `<button class="btn btn-sm btn-outline-secondary me-1" disabled
            title="Locked. Only Plutus staff can remove current-month perks.">
           Remove (${selectedCount})
         </button>`
      : `<button class="btn btn-sm btn-danger me-1" onclick="handlePerkRemove(${p.id})">
           Remove (${selectedCount})
         </button>`
  ) : `
    <button class="btn btn-sm btn-success me-1" onclick="togglePerk(${p.id})">
      Add
    </button>`
  }
  ${canStack ? `<button class="btn btn-sm btn-outline-primary me-1" onclick="stackPerk(${p.id})">+1 Stack</button>` : ''}
  <button class="btn btn-sm btn-outline-${favorite ? 'warning' : 'light'}" onclick="toggleFavorite(${p.id})">
    ★
  </button>
</div>
    `;

    if (localStorage.getItem('devMode') === '1') {
      div.addEventListener('click', () => showDevInspector('perk-selector', p));
      div.classList.add('table-info');
    }

    modalBody.appendChild(div);
    
  });

  document.getElementById("perkSelectorLimitDisplay").textContent =
    `${perkSelectorState.selected.length} / ${perkSelectorState.limit}`;
}

function togglePerk(id) {
  const selected = perkSelectorState.selected;
  const count = selected.filter(x => x === id).length;

  if (count === 0) {
    if (selected.length >= perkSelectorState.limit) return alert("Reached perk limit");
    selected.push(id);
  } else {
    if (perkSelectorState.mode === 'current') return; // Prevent removal in current month
    perkSelectorState.selected = selected.filter(x => x !== id);
  }

  renderPerkSelectorModal();
}

function stackPerk(id) {
  const selected = perkSelectorState.selected;
  const count = selected.filter(x => x === id).length;
  if (count !== 1 || perkSelectorState.stackingTokens < 1) return;
  if (selected.length >= perkSelectorState.limit) return alert("Reached total perk limit");
  selected.push(id);
  perkSelectorState.stackingTokens--;
  renderPerkSelectorModal();
}

function toggleFavorite(id) {
  const favs = perkSelectorState.favorites;
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  localStorage.setItem('perkFavorites', JSON.stringify(favs));
  renderPerkSelectorModal();
}

function toggleNextPerks() {
  const current = document.getElementById("currentPerksWrapper");
  const next = document.getElementById("nextPerksWrapper");
  const isShowingCurrent = current.style.display !== "none";
  current.style.display = isShowingCurrent ? "none" : "block";
  next.style.display = isShowingCurrent ? "block" : "none";
}

async function fetchPerks(token) {
  try {
    const res = await fetch("https://api.plutus.it/v3/perks/page-data", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      referrer: "https://app.plutus.it",
      referrerPolicy: "strict-origin-when-cross-origin",
      mode: "cors",
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.error("Perks fetch error", err);
    return null;
  }
}

function renderPerksTab(perksData) {
  const currentWrapper = document.getElementById("currentPerks");
  const nextWrapper = document.getElementById("nextPerks");
  const bonusWrapper = document.getElementById("bonusPerks");
  const perkCountLabel = document.getElementById("perkCount");
  const perkCountNextLabel = document.getElementById("perkCountNext");

  if (!currentWrapper || !nextWrapper || !perkCountLabel || !perkCountNextLabel || !bonusWrapper) return;

  function groupPerks(perks) {
    const map = new Map();
    for (const p of perks) {
      const key = p.id;
      if (!map.has(key)) {
        map.set(key, {
          ...p,
          count: 1,
          totalRewarded: parseFloat(p.currentMonthFiatRewarded || "0")
        });
      } else {
        const entry = map.get(key);
        entry.count += 1;
      }
    }
    return Array.from(map.values());
  }

  function renderCard(p, isBonus = false) {
    const max = parseFloat(p.maxMonthlyFiatReward || 10) * p.count;
    return `
      <div class="col-md-4 mb-3">
        <div class="card ${isBonus ? 'bg-dark text-warning' : 'bg-secondary text-light'} border-light h-100">
          <div class="card-body">
            <div class="d-flex align-items-center mb-2">
              <img src="${p.imageUrl}" alt="${p.label}" style="height: 24px; width: auto;" class="me-2">
              <h6 class="card-title mb-0">${p.label}</h6>
            </div>
            <p class="mb-1"><strong>${p.totalRewarded.toFixed(2)} / ${max.toFixed(2)} in PLUS</strong></p>
            <p class="mb-1">Stacks: ${p.count}</p>
            <div class="progress" style="height: 6px;">
              <div class="progress-bar bg-primary" role="progressbar" style="width: ${Math.min(100, (p.totalRewarded / max) * 100).toFixed(1)}%;"></div>
            </div>
          </div>
        </div>
      </div>`;
  }

  const current = groupPerks(perksData.currentMonthPerks || []);
  const next = groupPerks(perksData.nextMonthPerks || []);
  const bonus = groupPerks(perksData.bonusPerks || []);
  const selectedCount = perksData.currentMonthPerks?.length || 0;
  const selectedNextCount = perksData.nextMonthPerks?.length || 0;
  const perkLimit = perksData.perksLimit || 0;

  perkCountLabel.textContent = `(${selectedCount} of ${perkLimit})`;
  perkCountNextLabel.textContent = `(${selectedNextCount} of ${perkLimit})`;
  currentWrapper.innerHTML = current.map(p => renderCard(p)).join("");
  nextWrapper.innerHTML = next.map(p => renderCard(p)).join("");
  bonusWrapper.innerHTML = bonus.length
    ? `<h6 class="text-warning">Bonus Perks</h6><div class="row mt-2">${bonus.map(p => renderCard(p, true)).join("")}</div>`
    : "";
}

function handlePerkRemove(id) {
  // Filter out one instance of this ID (handles stacking)
  const index = perkSelectorState.selected.indexOf(id);
  if (index >= 0) {
    perkSelectorState.selected.splice(index, 1);
    renderPerkSelectorModal();
  }
}

function showPerkSaveConfirmation() {
  const previous = (perkSelectorState.mode === 'next'
    ? window.lastFetchedUserData?.perks?.nextMonthPerks
    : window.lastFetchedUserData?.perks?.currentMonthPerks) || [];

  const modal = new bootstrap.Modal(document.getElementById("perkConfirmModal"));
  const container = document.getElementById("perkConfirmBody");
  const confirmBtn = document.getElementById("perkConfirmSaveBtn");

  const previousMap = groupByIdWithCount(previous.map(p => p.id));
  const currentMap = groupByIdWithCount(perkSelectorState.selected);

  const allIds = new Set([...Object.keys(previousMap), ...Object.keys(currentMap)].map(id => parseInt(id)));

  let changes = [];
  for (const id of allIds) {
    const oldCount = previousMap[id] || 0;
    const newCount = currentMap[id] || 0;
    if (newCount !== oldCount) {
      const perk = perkSelectorState.perks.find(p => p.id === id);
      changes.push({
        id,
        label: perk?.label || `Perk #${id}`,
        imageUrl: perk?.imageUrl || '',
        oldCount,
        newCount
      });
    }
  }

  container.innerHTML = changes.map(p => `
    <div class="d-flex align-items-center mb-2">
      <img src="${p.imageUrl}" alt="${p.label}" style="height: 28px;" class="me-2">
      <strong>${p.label}</strong>
      <span class="ms-auto">${p.oldCount} ➜ ${p.newCount}</span>
    </div>
  `).join('') || '<p class="text-muted">No changes detected.</p>';

  confirmBtn.onclick = () => doSavePerks();
  modal.show();
}

function doSavePerks() {
  const token = document.getElementById("authToken").value.trim();
  fetch("https://api.plutus.it/v3/perks/update", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    referrer: "https://app.plutus.it",
    referrerPolicy: "strict-origin-when-cross-origin",
    mode: "cors",
    body: JSON.stringify({ newPerks: perkSelectorState.selected, term: perkSelectorState.mode })
  })
  .then(res => res.json())
  .then(json => {
    alert("✅ Perks updated successfully");
    bootstrap.Modal.getInstance(document.getElementById("perkSelectorModal")).hide();
    bootstrap.Modal.getInstance(document.getElementById("perkConfirmModal")).hide();
    fetchData();
  })
  .catch(err => {
    console.error("Update failed", err);
    alert("❌ Failed to update perks");
  });
}

function groupByIdWithCount(list) {
  const map = {};
  for (const id of list) {
    map[id] = (map[id] || 0) + 1;
  }
  return map;
}




function filterTransactionTable() {
  const query = document.getElementById("transactionSearchInput").value.toLowerCase();
  const excludeTypes = Array.from(document.getElementById("excludeTypeFilter").selectedOptions)
                            .map(opt => opt.value);

  const rows = document.querySelectorAll("#transactionTable tbody tr");

  rows.forEach(row => {
    const description = row.cells[0]?.innerText.toLowerCase();
    const type = row.cells[2]?.innerText.trim(); // 3rd column is type

    const matchesSearch = description.includes(query);
    const excluded = excludeTypes.includes(type);

    row.style.display = matchesSearch && !excluded ? "" : "none";
  });
}



function exportStatementCSV() {
  if (!window.lastFetchedTransactions) {
    alert("No transactions loaded.");
    return;
  }

  const fromInput = document.getElementById("statementFromDate").value;
  const toInput = document.getElementById("statementToDate").value;

  const fromDate = new Date(fromInput || 0);
  const toDate = new Date(toInput || Date.now());
  toDate.setDate(toDate.getDate() + 1); // include full day

  const excludedTypes = Array.from(document.getElementById("excludeTypeFilter").selectedOptions).map(opt => opt.value);

  const filtered = window.lastFetchedTransactions.filter(tx => {
    const txDate = new Date(tx.date);
    return (
      txDate >= fromDate &&
      txDate < toDate &&
      !excludedTypes.includes(tx.type)
    );
  });

  if (!filtered.length) {
    alert("No transactions matched the filters.");
    return;
  }

  const rows = filtered.map(tx => ({
    Date: new Date(tx.date).toLocaleString(),
    Description: tx.cleanDescription || tx.description || '',
    Type: tx.type,
    Status: tx.status || '',
    Amount: parseFloat(tx.amount).toFixed(2),
    MCC: tx.mcc || '',
    PLU_Earned: parseFloat(tx.totalPluAmount || 0).toFixed(4),
    RewardRate: (loadRewardRateCache()[tx.id]?.rate || '--'),
    ID: tx.id
  }));

  const formatDate = (d) => new Date(d).toISOString().slice(0, 10);
  const filename = `statement_${formatDate(fromDate)}_to_${formatDate(new Date(toDate - 1))}.csv`;

  generateCSV(rows, filename);
}




function exportFilteredRewards() {
  if (!window.lastFetchedRewards) {
    alert("No rewards data loaded.");
    return;
  }

  const fromInput = document.getElementById("rewardFromDate").value;
  const toInput = document.getElementById("rewardToDate").value;

  const fromDate = new Date(fromInput || 0);
  const toDate = new Date(toInput || Date.now());
  toDate.setDate(toDate.getDate() + 1); // include full day

  const statusFilter = document.getElementById("rewardStatusFilter").value.toLowerCase();

  const filtered = window.lastFetchedRewards.filter(r => {
    const createdAt = new Date(r.createdAt);
    const matchesStatus = !statusFilter || r.status.toLowerCase() === statusFilter;
    return createdAt >= fromDate && createdAt < toDate && matchesStatus;
  });

  if (!filtered.length) {
    alert("No rewards matched the filters.");
    return;
  }

  const rows = filtered.map(r => ({
    ID: r.id,
    Ticker: r.ticker,
    Amount: r.amount,
    FiatAmount: r.fiatAmountRewarded ? (r.fiatAmountRewarded / 100).toFixed(2) : '',
    Status: r.status,
    Type: r.type,
    Description: r.transactionDescription || '',
    RewardRate: r.rewardRate || '',
    CreatedAt: new Date(r.createdAt).toLocaleString(),
    AutoApprovesAt: new Date(new Date(r.createdAt).getTime() + 45 * 24 * 60 * 60 * 1000).toLocaleString()
  }));

  const formatDate = (d) => new Date(d).toISOString().slice(0, 10);
  const filename = `rewards_${formatDate(fromDate)}_to_${formatDate(new Date(toDate - 1))}.csv`;

  generateCSV(rows, filename);
}


