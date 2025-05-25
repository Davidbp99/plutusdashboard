const injectBtn = document.getElementById("injectBtn");
const goBtn = document.getElementById("goBtn");
const statusEl = document.getElementById("status");
const autoInjectCheckbox = document.getElementById("autoInject");

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const isPlutus = tab.url.includes("app.plutus.it");
  injectBtn.style.display = isPlutus ? "block" : "none";
  goBtn.style.display = isPlutus ? "none" : "block";
  statusEl.textContent = isPlutus ? "Ready to inject" : "Not on app.plutus.it";
});

injectBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["uiimprover.js"] });
  statusEl.textContent = "Injected";
});

goBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "https://app.plutus.it" });
});

chrome.storage.local.get("autoInject", ({ autoInject }) => {
  autoInjectCheckbox.checked = !!autoInject;
});

autoInjectCheckbox.addEventListener("change", () => {
  chrome.storage.local.set({ autoInject: autoInjectCheckbox.checked });
});
