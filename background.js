// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "toggle-store-type",
    title: "Toggle Store Type (Dev/Prod)",
    contexts: ["page"],
    documentUrlPatterns: [
      "https://*.myshopify.com/*",
      "https://*.shopify.com/*",
      "https://*.myshopify.io/*"
    ]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "toggle-store-type") {
    // Send message to content script to toggle
    chrome.tabs.sendMessage(tab.id, { action: "toggleStoreType" });
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getActiveTabUrl") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({ url: tabs[0].url });
      }
    });
    return true; // Keep channel open for async response
  } else if (request.action === "openPopup") {
    // Open the extension popup programmatically
    chrome.action.openPopup();
  }
});