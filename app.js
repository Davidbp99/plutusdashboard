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
        headers: { 'Authorization': `Bearer ${token}` }
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
  
      const tbody = document.querySelector("#rewardTable tbody");
      tbody.innerHTML = "";
  
      rewards.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      rewards.forEach(entry => {
        const createdAt = new Date(entry.createdAt);
        const approveAt = new Date(createdAt.getTime() + 45 * 24 * 60 * 60 * 1000);
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${entry.id}</td>
          <td>${entry.ticker}</td>
          <td>${entry.amount}</td>
          <td>${entry.fiatAmountRewarded || '-'}</td>
          <td><span class="badge bg-${entry.status === 'approved' ? 'success' : 'warning'}">${entry.status}</span></td>
          <td>${entry.type}</td>
          <td>${entry.transactionDescription || '-'}</td>
          <td>${entry.rewardRate || '-'}</td>
          <td>${createdAt.toLocaleString()}</td>
          <td>${approveAt.toLocaleString()}</td>
        `;
        tbody.appendChild(row);
      });
  
      renderForecast(rewards);
      fetchGiftCards(token);
      fetchGiftCardVault(token);
      fetchTransactions(token, limit, rewardRateMap);
      const [crySummary, subscription, wallets] = await Promise.all([
        fetchCrySummary(token),
        fetchSubscriptionInfo(token),
        fetchStakingWallets(token)
      ]);
      renderUserSettings(crySummary, subscription, wallets);
      
      

  
    } catch (error) {
      console.error("Fetch error:", error);
      alert("An error occurred while fetching data.");
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
        }
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
      }
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
      row.innerHTML = `
        <td>${getDescription(tx)}</td>
        <td>${getMCC(tx)}</td>
        <td>${txType}</td>
        <td>${tx.status || '—'}</td>
        <td>${parseFloat(tx.amount).toFixed(2)} ${tx.currency}</td>
        <td>${tx.originalTransactionId || '—'}</td>
        <td>${parseFloat(tx.totalPluAmount || 0).toFixed(4)}</td>
        <td id=\"rewardRate-${tx.id}\">Loading...</td>
      `;

      if (txType === 'DEPOSIT_FUNDS_RECEIVED' || txType === 'PAYIN') {
        row.classList.add("table-success");
        const cell = row.querySelector(`#rewardRate-${tx.id}`);
        if (cell) cell.innerText = '--';
      } else if (isRefund) {
        row.classList.add("table-warning");
      }

      tbody.appendChild(row);

      if (txType !== 'DEPOSIT_FUNDS_RECEIVED' && txType !== 'PAYIN' && txType !== "PLUTUS_WALLET_GIFTCARD_SWAP_FEE") {
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
      }
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

}

function applyFilters() {
    const country = document.getElementById("countryFilter").value;
    const selectedCats = Array.from(document.querySelectorAll("#categoryFilters input:checked")).map(el => el.value);
    const showVault = document.getElementById("vaultOnlyToggle").checked;
    const amountRange = document.getElementById("amountFilter").value;
    const searchTerm = document.getElementById("searchFilter").value.trim().toLowerCase();
  
    let minAmount = 0, maxAmount = Infinity;
    if (amountRange) {
      const [minStr, maxStr] = amountRange.split("-");
      minAmount = parseFloat(minStr);
      maxAmount = parseFloat(maxStr);
    }
  
    const filterFunc = (card) => {
      const countryMatch = !country || card.countries.includes(country);
      const categoryMatch = selectedCats.length === 0 || selectedCats.some(cat => card.categories.includes(cat));
      const denomMatch = (card.denominations || []).some(val => val >= minAmount && val <= maxAmount);
      const nameMatch = !searchTerm || card.name.toLowerCase().includes(searchTerm);
      return countryMatch && categoryMatch && denomMatch && nameMatch;
    };
  
    if (showVault) {
      const filtered = giftcardVault
        .filter(entry => filterFunc(entry.brand))
        .sort((a, b) => {
          const aMax = Math.max(...(a.brand.denominations || [0]));
          const bMax = Math.max(...(b.brand.denominations || [0]));
          return bMax - aMax;
        });
  
      renderVaultCards(filtered);
    } else {
      const filtered = allGiftCards
        .filter(filterFunc)
        .sort((a, b) => {
          const aMax = Math.max(...(a.denominations || [0]));
          const bMax = Math.max(...(b.denominations || [0]));
          return bMax - aMax;
        });
  
      renderGiftCards(filtered);
    }
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
            <p class="card-text mb-1"><strong>Giftcards Amounts:</strong> ${denominations} ${currency}</p>
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
      }
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
        "Content-Type": "application/json"
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
  
  async function fetchRewardRatesWithConcurrency(token, transactions, maxConcurrent = 5) {
    const queue = [...transactions];
    const workers = [];
  
    for (let i = 0; i < maxConcurrent; i++) {
      workers.push((async () => {
        while (queue.length > 0) {
          const tx = queue.pop();
          await fetchRewardRateForTransaction(token, tx.id, tx.date);
        }
      })());
    }
  
    await Promise.all(workers);
  }

  

 
  
  

  async function fetchCrySummary(token) {
    try {
      const res = await fetch("https://api.plutus.it/v3/cry/ledger/summary", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data;
    } catch (err) {
      console.error("CRY fetch error", err);
      return null;
    }
  }
  
  function renderUserSettings(summary, subscription = null, wallets = []) {
    const container = document.getElementById("userSettingsContainer");
    container.innerHTML = "";
  
    if (!summary) {
      container.innerHTML = `<p class="text-danger">Failed to load user summary.</p>`;
      return;
    }
  
    const total = parseFloat(summary.totalBalance);
    const reward = parseFloat(summary.availableReward);
    const rate = parseInt(summary.cryRate);
  
    let level = CRY_REWARD_LEVELS[0].label;
    for (const tier of CRY_REWARD_LEVELS) {
      if (total >= tier.threshold) level = tier.label;
      else break;
    }
  
    const subInfo = subscription
      ? `
        <div class="card bg-secondary text-light border-light mt-3">
          <div class="card-body">
            <h6 class="card-title">Subscription</h6>
            <p class="card-text mb-1"><strong>Plan:</strong> ${subscription.plan}</p>
            <p class="card-text mb-1"><strong>Billing:</strong> ${subscription.billingCycle}</p>
            <p class="card-text mb-1"><strong>Start:</strong> ${new Date(subscription.start).toLocaleDateString()}</p>
            <p class="card-text mb-0"><strong>End:</strong> ${new Date(subscription.end).toLocaleDateString()}</p>
          </div>
        </div>
      `
      : `<p class="text-muted mt-3">No subscription data found.</p>`;
  
    const walletCards = wallets.map(w => {
      const short = `${w.address.slice(0, 6)}...${w.address.slice(-4)}`;
      return `
        <div class="col-md-12 mb-2">
          <div class="card bg-secondary text-light border-light">
            <div class="card-body d-flex justify-content-between align-items-center">
              <div>
                <strong>Wallet:</strong> <code>${short}</code><br>
                <strong>Balance:</strong> ${parseFloat(w.balance).toFixed(4)} PLU
              </div>
              <a href="https://etherscan.io/address/${w.address}#tokentxns" target="_blank" class="btn btn-outline-info btn-sm">View on Etherscan</a>
            </div>
          </div>
        </div>
      `;
    }).join("");
  
    container.innerHTML = `
      <div class="col-md-6">
        <div class="card bg-dark text-light border-secondary">
          <div class="card-body">
            <h5 class="card-title">Summary</h5>
            <p class="card-text mb-1"><strong>Total PLU:</strong> ${total.toFixed(2)}</p>
            <p class="card-text mb-1"><strong>Available Rewards:</strong> ${reward.toFixed(2)} CRY</p>
            <p class="card-text mb-1"><strong>Reward Level:</strong> <span class="badge bg-info text-dark">${level}</span></p>
            <p class="card-text mb-0"><strong>CRY Rate:</strong> ${rate}</p>
          </div>
        </div>
        ${subInfo}
      </div>
      <div class="col-md-6">
        <h5 class="text-light mb-3">Staking Wallets</h5>
        ${walletCards || `<p class="text-muted">No wallets found.</p>`}
      </div>
    `;
  }
  
  
  async function fetchSubscriptionInfo(token) {
    try {
      const res = await fetch("https://api.plutus.it/v3/subscription", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
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
        ${recurring.map(r => `<tr><td>${r.merchant} <button class='btn btn-sm btn-outline-danger ms-2' onclick='dismissRecurring("${r.merchant}")'>X</button></td><td>€${r.totalSpent.toFixed(2)}</td><td>${r.txCount}</td><td>€${r.avgAmount.toFixed(2)}</td><td>${r.avgInterval.toFixed(1)}</td></tr>`).join('')}
      </tbody>
    </table>
    <h4 class="mt-4">Category Breakdown</h4>
<button class="btn btn-sm btn-outline-light mb-2" onclick='generateCSV(window._categoriesCSVData, "categories.csv")'>Export Categories</button>
    <table class="table table-hover">
      <thead><tr><th>Category</th><th>Total Spent</th><th>Tx Count</th><th>Avg Spend</th><th>Total PLU</th></tr></thead>
      <tbody>
        ${categories.map(c => `<tr><td>${c.category}</td><td>€${c.spend.toFixed(2)}</td><td>${c.count}</td><td>€${c.avgSpend.toFixed(2)}</td><td>${c.plu.toFixed(4)}</td></tr>`).join('')}
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


