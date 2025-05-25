function onReady(fn) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(fn, 900); 
  } else {
    document.addEventListener("DOMContentLoaded", () => setTimeout(fn, 900));
  }
}

onReady(() => {
  chrome.storage?.local?.get("autoInject", ({ autoInject }) => {
    if (!autoInject || window.__plutusUIInjected) return;
    window.__plutusUIInjected = true;

    const injectScript = (src) => {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL(src);
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    };

    injectScript("uiimprover.js");
  });
});