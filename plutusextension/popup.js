const main = document.getElementById("main");
const status = document.getElementById("status");

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab || !tab.url) {
    status.textContent = "❌ Could not get current tab.";
    return;
  }

  const url = new URL(tab.url);
  if (url.hostname !== "app.plutus.it") {
    status.textContent = "🔒 You must be on app.plutus.it to use the sniffer.";

    const btn = document.createElement("button");
    btn.textContent = "Go to Plutus";
    btn.onclick = () => {
      chrome.tabs.create({ url: "https://app.plutus.it" });
    };
    main.appendChild(btn);
    return;
  }

  status.textContent = "✅ Ready to inject";

  const btn = document.createElement("button");
  btn.textContent = "Activate Sniffer";
  btn.onclick = async () => {
    status.textContent = "Injecting...";
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["sniffer.js"]
      });
      status.textContent = "✅ Sniffer injected.";
    } catch (err) {
      console.error(err);
      status.textContent = "❌ Failed to inject.";
    }
  };

  main.appendChild(btn);
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
if (message.type === "open-dashboard") {
  const token = message.token;
  const useClipboardOnly = document.getElementById("clipboard-only")?.checked;

  if (useClipboardOnly) {
    navigator.clipboard.writeText(token)
      .then(() => {
        status.textContent = "📋 Token copied to clipboard.";
      })
      .catch(err => {
        console.error(err);
        status.textContent = "❌ Failed to copy token.";
      });
  } else {
    chrome.tabs.create({
      url: `https://davidbp99.github.io/plutusdashboard/?token=${encodeURIComponent(token)}`
    });
  }
}

});


