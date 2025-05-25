(function () {
  console.log("✅ uiimprover.js running");

  // === PERK MODAL ENHANCEMENTS ===
  const patchModalStyle = () => {
    if (document.getElementById("perk-style-patch")) return;
    const style = document.createElement("style");
    style.id = "perk-style-patch";
    style.textContent = `.max-w-xl { max-width: 60rem !important; }`;
    style.textContent += `
  #perkSearch::placeholder {
    color: #999;
    font-style: italic;
  }
  .favorite-toggle {
    cursor: pointer;
    transition: color 0.2s ease;
  }
  .favorite-toggle:hover {
    color: #eab308 !important; /* Tailwind yellow-400 */
  }
`;

    document.head.appendChild(style);
  };

  const getFavorites = () => JSON.parse(localStorage.getItem("perkFavorites") || "[]");

  const toggleFavorite = (id) => {
    const favs = getFavorites();
    const i = favs.indexOf(id);
    i >= 0 ? favs.splice(i, 1) : favs.push(id);
    localStorage.setItem("perkFavorites", JSON.stringify(favs));
    updateFavoriteStyles();
    applyFilters();
  };

  const updateFavoriteStyles = () => {
    const favs = getFavorites();
    document.querySelectorAll(".favorite-toggle").forEach(btn => {
      const label = btn.closest(".border.rounded-lg")?.dataset?.perkId;
      btn.classList.toggle("text-yellow-400", favs.includes(label));
      btn.classList.toggle("text-gray-400", !favs.includes(label));
    });
  };

  const applyFilters = () => {
    const search = document.getElementById("perkSearch")?.value.trim().toLowerCase() || "";
    const showFavs = document.getElementById("showFavorites")?.checked;
    const favs = getFavorites();
    document.querySelectorAll(".mt-4 .border.rounded-lg").forEach(perk => {
      const label = perk.querySelector(".font-medium")?.textContent.trim();
      if (!label) return;
      const matchSearch = label.toLowerCase().includes(search);
      const matchFav = !showFavs || favs.includes(label);
      perk.style.display = matchSearch && matchFav ? "block" : "none";
    });
  };

  const injectNativePerkEnhancements = () => {
    if (document.getElementById("perkSearch")) return;
    const container = document.querySelector(".mt-4 > .space-y-2") || document.querySelector(".mt-4.space-y-2");
    if (!container) return;

    const filterWrap = document.createElement("div");
    filterWrap.className = "mb-4 flex gap-2 items-center";
filterWrap.innerHTML = `
  <input id="perkSearch" type="text" placeholder="🔍 Search perks..."
    class="px-3 py-2 border border-gray-300 rounded-lg w-60 text-sm shadow-sm focus:ring focus:ring-blue-200 focus:outline-none transition-all" />
  <label class="flex items-center space-x-2 text-sm text-gray-700 select-none cursor-pointer">
    <input type="checkbox" id="showFavorites"
      class="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400 transition-all" />
    <span>⭐ Show favorites only</span>
  </label>
`;

    container.parentElement.insertBefore(filterWrap, container);
    document.getElementById("perkSearch").addEventListener("input", applyFilters);
    document.getElementById("showFavorites").addEventListener("change", applyFilters);

    container.querySelectorAll(".border.rounded-lg").forEach(perk => {
      const label = perk.querySelector(".font-medium");
      if (!label) return;
      const id = label.textContent.trim();
      perk.dataset.perkId = id;

      const favBtn = document.createElement("button");
      favBtn.textContent = "★";
      favBtn.className = "ml-2 text-sm favorite-toggle text-gray-400";
      favBtn.onclick = e => { e.stopPropagation(); toggleFavorite(id); };

      const meta = label.parentElement.querySelector("p.text-sm");
      if (meta) meta.parentElement.appendChild(favBtn);
    });

    updateFavoriteStyles();
    applyFilters();
  };



  const watchForPerkModal = () => {
    new MutationObserver(() => {
      const modal = document.querySelector("h2.text-lg.font-bold");
      if (modal && modal.textContent.includes("Select Perks") && !document.getElementById("perkSearch")) {
        patchModalStyle();
        injectNativePerkEnhancements();
        fixPerkProgressBars();
        fixPerkModalLayout();

      }
    }).observe(document.body, { childList: true, subtree: true });
  };

  function fixTooltipOverflow() {
  const style = document.createElement("style");
  style.id = "tooltip-overflow-fix";
  style.textContent = `
    /* Try to catch general tooltip-wrapping containers and fix overflow */
    .relative, .overflow-hidden, [class*="overflow-"] {
      overflow: visible !important;
    }

    /* Fix specific parent wrapping the tooltip if known */
    div[data-radix-popper-content-wrapper] {
      z-index: 9999 !important;
    }

    /* Optional: If it's in a timeline or stepper, fix that too */
    .timeline-container, .stepper-container {
      overflow: visible !important;
    }
  `;
  document.head.appendChild(style);
}
function watchAndFixTooltipOverflow() {
  new MutationObserver(() => {
    const tip = document.querySelector('[data-radix-popper-content-wrapper]');
    if (tip && !document.getElementById("tooltip-overflow-fix")) {
      fixTooltipOverflow();
    }
  }).observe(document.body, { childList: true, subtree: true });
}

watchAndFixTooltipOverflow();


function injectStatementSearchBar() {
  if (document.getElementById("statementSearch")) return;

  const containers = document.querySelectorAll(".bg-white.p-6.md\\:p-8");

  containers.forEach(container => {
    const title = container.querySelector("p.text-xl");
    if (!title || !title.textContent.includes("Transaction History")) return;


    const inputWrap = document.createElement("div");
    inputWrap.className = "mb-4 flex justify-end";
    inputWrap.innerHTML = `
      <input
        id="statementSearch"
        type="text"
        placeholder="🔍 Search transactions..."
        class="w-full md:w-1/2 px-3 py-2 rounded-lg border border-gray-300 text-sm shadow-sm focus:outline-none focus:ring focus:ring-blue-200 transition-all"
      />
    `;

    title.insertAdjacentElement("afterend", inputWrap);

    document.getElementById("statementSearch").addEventListener("input", () => {
      const q = document.getElementById("statementSearch").value.trim().toLowerCase();

      document.querySelectorAll(".flex.items-center.gap-4.justify-between.cursor-pointer").forEach(el => {
        const label = el.querySelector("p.font-medium")?.textContent?.toLowerCase() || "";
        const date = el.querySelector("p.text-sm")?.textContent?.toLowerCase() || "";
        const amount = el.querySelector("p.text-base")?.textContent?.toLowerCase() || "";

        const match = label.includes(q) || date.includes(q) || amount.includes(q);
        el.style.display = match ? "flex" : "none";
      });
    });
  });
}




  function fixPerkProgressBars() {
  document.querySelectorAll(".border.rounded-lg.p-4.flex").forEach(perkCard => {
    const text = perkCard.querySelector("p.text-sm")?.textContent || "";
    const match = text.match(/€([\d.]+)\s*\/\s*€([\d.]+)/);
    if (!match) return;

    const current = parseFloat(match[1]);
    const total = parseFloat(match[2]);
    if (isNaN(current) || isNaN(total) || total === 0) return;

    const percent = Math.min(100, (current / total) * 100).toFixed(2);
    const bar = perkCard.querySelector(".RSPBprogression");
    if (bar) {
      bar.style.width = `${percent}%`;
      bar.title = `Progress: ${percent}%`;
    }
  });
}

function convertDaysToDateInVoucherBox() {
  document.querySelectorAll(".bg-\\[\\#E3EEFF\\]").forEach(box => {
    if (box.classList.contains("voucher-date-patched")) return;

    const textNode = Array.from(box.querySelectorAll("div, p"))
      .find(el => el.textContent.includes("in ") && el.textContent.includes(" days"));

    if (!textNode) return;

    const match = textNode.textContent.match(/in (\d{1,3}) days/);
    if (!match) return;

    const days = parseInt(match[1], 10);
    if (isNaN(days)) return;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const dateStr = futureDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    textNode.textContent = textNode.textContent.replace(
      /in \d{1,3} days/,
      `on ${dateStr}`
    );

    box.classList.add("voucher-date-patched");
  });
}

  // === PLUTON ENHANCEMENTS ===

  function getPlutonRootContainer() {
    return Array.from(document.querySelectorAll("div.bg-white")).find(div =>
      div.querySelector("h2.text-lg.font-semibold")?.textContent.includes("Transactions") &&
      div.querySelector("button span")?.textContent?.match(/\d{1,2} \w{3,9} \d{4} to \d{1,2} \w{3,9} \d{4}/)
    );
  }
function fixPerkModalLayout() {
  const modal = document.querySelector('.bg-white.p-6.rounded-lg.shadow-lg.relative');
  if (!modal) return;

  const body = modal.querySelector('div.mt-4');
  if (!body) return;

  // Re-apply critical layout classes if missing
  body.classList.add('max-h-[80vh]', 'overflow-y-auto');
}

function injectFutureDatesEverywhere() {
  const root = getPlutonRootContainer();
  if (!root) return;

  root.querySelectorAll('.text-text-secondary.text-sm.font-mnky').forEach(el => {
    const container = el.parentElement;
    if (!container || container.classList.contains("plutus-date-patched")) return;

    const text = el.textContent.trim();
    let date;

    if (text.startsWith("Today,")) {
      const timeMatch = text.match(/Today,\s*(\d{2}):(\d{2})/);
      if (!timeMatch) return;
      const now = new Date();
      date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(timeMatch[1]), parseInt(timeMatch[2]));
    } else {
      const match = text.match(/(\d{1,2}) (\w{3,9}) (\d{4}), (\d{2}):(\d{2})/);
      if (!match) return;
      date = new Date(`${match[1]} ${match[2]} ${match[3]} ${match[4]}:${match[5]}`);
    }

    if (isNaN(date)) return;

    date.setDate(date.getDate() + 45);
    const newLine = document.createElement("p");
    newLine.textContent = `⏳ Unlocks on ${date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })}`;
    newLine.classList.add("plutus-unlock-label");
    newLine.style.cssText = "font-size: 0.75rem; color: #888;";
    container.appendChild(newLine);
    container.classList.add("plutus-date-patched");
  });

  root.querySelectorAll('.flex.justify-between.text-sm').forEach(row => {
    if (row.classList.contains("plutus-date-patched")) return;
    const label = row.children?.[0]?.textContent?.trim();
    if (!label || !label.toLowerCase().includes("timestamp")) return;

    const dateSpan = row.children?.[1];
    const text = dateSpan?.textContent?.trim();
    let date;

    if (text?.startsWith("Today,")) {
      const timeMatch = text.match(/Today,\s*(\d{2}):(\d{2})/);
      if (!timeMatch) return;
      const now = new Date();
      date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(timeMatch[1]), parseInt(timeMatch[2]));
    } else {
      const match = text?.match(/(\d{1,2}) (\w{3,9}) (\d{4}), (\d{2}):(\d{2})/);
      if (!match) return;
      date = new Date(`${match[1]} ${match[2]} ${match[3]} ${match[4]}:${match[5]}`);
    }

    if (isNaN(date)) return;

    date.setDate(date.getDate() + 45);
    const injectEl = document.createElement("div");
    injectEl.textContent = `⏳ Unlocks on ${date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })}`;
    injectEl.classList.add("plutus-unlock-label");
    injectEl.style.cssText = "font-size: 0.75rem; color: #888; margin-top: 4px;";
    row.parentElement.insertBefore(injectEl, row.nextSibling);
    row.classList.add("plutus-date-patched");
  });
}


  function injectUnlockInRewardDrawer() {
    const drawers = document.querySelectorAll("div.p-4.rounded-lg.border.bg-white");


    drawers.forEach(drawer => {
      if (drawer.classList.contains("plutus-date-patched")) return;

      const row = Array.from(drawer.querySelectorAll(".flex.justify-between.text-sm"))
        .find(div => div.children?.[0]?.textContent?.trim() === "Timestamp:");

      const dateSpan = row?.children?.[1];
      if (!dateSpan || dateSpan.classList.contains("plutus-unlock-label")) return;

      const match = dateSpan.textContent.trim().match(/(\d{1,2}) (\w{3,9}) (\d{4}), (\d{2}):(\d{2})/);
      if (!match) return;

      const date = new Date(`${match[1]} ${match[2]} ${match[3]} ${match[4]}:${match[5]}`);
      if (isNaN(date)) return;

      date.setDate(date.getDate() + 45);
      const unlockEl = document.createElement("div");
      unlockEl.textContent = `⏳ Unlocks on ${date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })}`;
      unlockEl.classList.add("plutus-unlock-label");
      unlockEl.style.cssText = "font-size: 0.75rem; color: #888; margin-top: 4px;";
      row.parentElement.insertBefore(unlockEl, row.nextSibling);
      drawer.classList.add("plutus-date-patched");
    });
  }
  function fixSpendingLimitBars() {
  const cards = document.querySelectorAll(".bg-primary.p-6.rounded-xl");

  cards.forEach(card => {
    const label = card.querySelector("span.font-semibold")?.textContent || "";
    const match = label.match(/€([\d,.]+)\s*\/\s*€([\d,.]+)/);
    if (!match) return;

    const current = parseFloat(match[1].replace(/,/g, ""));
    const total = parseFloat(match[2].replace(/,/g, ""));
    if (isNaN(current) || isNaN(total) || total === 0) return;

    const percent = Math.min(100, (current / total) * 100);
    const bars = card.querySelectorAll("div.h-2.rounded-sm");

    bars.forEach((bar, index) => {
      const lower = index * 20;
      const upper = (index + 1) * 20;

      if (percent >= upper) {
        bar.style.backgroundColor = "rgba(255, 255, 255, 0.9)"; // fully lit
      } else if (percent > lower) {
        // partial fill – optional
        const fillRatio = (percent - lower) / 20;
        bar.style.backgroundImage = `linear-gradient(to right, rgba(255,255,255,0.9) ${fillRatio * 100}%, rgba(255,255,255,0.2) ${fillRatio * 100}%)`;
        bar.style.backgroundColor = ""; // clear fallback
      } else {
        bar.style.backgroundColor = "rgba(255, 255, 255, 0.2)"; // dim
        bar.style.backgroundImage = "";
      }
    });
  });
}


  let debounceTimer = null;
  let plutonObserverStarted = false;

  const watchForPlutonChanges = () => {
    if (plutonObserverStarted) return;
    plutonObserverStarted = true;

    new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        injectFutureDatesEverywhere();
        injectUnlockInRewardDrawer();
      }, 300);
    }).observe(document.body, { childList: true, subtree: true });

    injectFutureDatesEverywhere();
    injectUnlockInRewardDrawer();
  };

  const clearPlutonInjections = () => {
    const root = getPlutonRootContainer();
    if (root) {
      root.querySelectorAll(".plutus-unlock-label").forEach(el => el.remove());
      root.querySelectorAll(".plutus-date-patched").forEach(el => el.classList.remove("plutus-date-patched"));
    }

    document.querySelectorAll(".plutus-unlock-label").forEach(el => el.remove());
    document.querySelectorAll(".plutus-date-patched").forEach(el => el.classList.remove("plutus-date-patched"));

    console.log("🧼 Cleared pluton injections (navigated away)");
  };

  // === ROUTE MONITOR ===
let lastPath = location.pathname;
setInterval(() => {
  const currentPath = location.pathname;
  if (currentPath !== lastPath) {
    lastPath = currentPath;

    if (currentPath.includes("/pluton")) {
      console.log("🧭 Navigated to /pluton");
      watchForPlutonChanges();
    } else {
      clearPlutonInjections();
    }

    if (currentPath.includes("/perks")) {
      console.log("🧭 Navigated to /perks");
      setTimeout(fixPerkProgressBars, 500); // give DOM a bit of time to render
    }
    if (currentPath.includes("/")) {
  setTimeout(fixSpendingLimitBars, 500);
}
if (currentPath.includes("/statements")) {
  console.log("🧭 Navigated to /statements");
  setTimeout(injectStatementSearchBar, 500); // delay to wait for DOM
    setTimeout(() => {
    convertDaysToDateInVoucherBox();
  }, 500);
}

if (currentPath.includes("/")) {
  setTimeout(() => {
    convertDaysToDateInVoucherBox();
  }, 500);
}


  }
}, 500);
function observeProgressBars() {
  const observer = new MutationObserver(() => {
    fixPerkProgressBars();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Run initially
  fixPerkProgressBars();
}


const EXCLUDED_PENDING_LABELS = [
  "gift service fees",
  "block code uab vil",
  "block code uab",
  "payout fee",

];


function flagPendingTransactions() {
  document.querySelectorAll(".flex.items-center.gap-4.justify-between.cursor-pointer").forEach(row => {
    const amountEl = row.querySelector("p.text-base");
    const labelEl = row.querySelector("p.font-medium");

    if (!amountEl || !labelEl) return;

    const labelText = labelEl.textContent.trim().toLowerCase();

    // Skip if label matches any exclusion
    if (EXCLUDED_PENDING_LABELS.some(keyword => labelText.includes(keyword))) return;

    if (row.querySelector(".plutus-pending-badge")) return;

    const bonusBadge = row.querySelector("p.bg-primary-info");
    const value = amountEl.textContent.trim();
    const isNegative = /^-\€/.test(value);

    if (isNegative && !bonusBadge) {
      const badge = document.createElement("p");
      badge.textContent = "Pending";
      badge.className = "plutus-pending-badge px-2 py-[2.5px] bg-yellow-100 text-yellow-700 rounded-full text-[13px] font-semibold";
      amountEl.parentElement.appendChild(badge);
    }
  });
}



function watchPendingTransactions() {
  let timeout;

  const observer = new MutationObserver(() => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      flagPendingTransactions();
    }, 100); // 100ms debounce
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial run
  flagPendingTransactions();
}

  // === INIT ===
  watchPendingTransactions();

  observeProgressBars();
  watchForPerkModal();
  fixPerkProgressBars();
  fixSpendingLimitBars();
  injectStatementSearchBar();
})();
