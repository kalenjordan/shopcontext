document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    currentUrl: document.getElementById('current-url'),
    storeType: document.getElementById('store-type'),
    toggleBtn: document.getElementById('toggle-btn'),
    customNameInput: document.getElementById('custom-name'),
    saveNameBtn: document.getElementById('save-name'),
    prodColorInput: document.getElementById('prod-color'),
    prodColorText: document.getElementById('prod-color-text'),
    saveColorBtn: document.getElementById('save-color')
  };
  
  let currentTabId;
  let currentUrl;
  let currentDomain;
  
  // Get current tab info
  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }
  
  // Check if URL is a Shopify store
  function isShopifyUrl(url) {
    if (!url) return false;
    return url.includes('myshopify.com') || 
           url.includes('myshopify.io') || 
           url.includes('shopify.com');
  }
  
  // Get domain from URL
  function getDomain(url) {
    try {
      const urlObj = new URL(url);
      // For admin.shopify.com URLs, extract the store handle from the path
      if (urlObj.hostname === 'admin.shopify.com') {
        const pathMatch = urlObj.pathname.match(/^\/store\/([^\/]+)/);
        if (pathMatch && pathMatch[1]) {
          return pathMatch[1]; // Returns the store handle (e.g., "kalen-test-store")
        }
      }
      return urlObj.hostname;
    } catch {
      return null;
    }
  }
  
  // Load and display current status
  async function loadCurrentStatus() {
    const tab = await getCurrentTab();
    currentTabId = tab.id;
    currentUrl = tab.url;
    currentDomain = getDomain(currentUrl);
    
    if (!isShopifyUrl(currentUrl)) {
      elements.currentUrl.textContent = 'Not on a Shopify store';
      elements.storeType.className = 'store-type unknown';
      elements.storeType.querySelector('.type-icon').textContent = '❓';
      elements.storeType.querySelector('.type-text').textContent = 'Not a Shopify Store';
      elements.toggleBtn.disabled = true;
      elements.customNameInput.disabled = true;
      elements.saveNameBtn.disabled = true;
      elements.prodColorInput.disabled = true;
      elements.prodColorText.disabled = true;
      elements.saveColorBtn.disabled = true;
      return;
    }
    
    // Display store handle/domain nicely
    if (currentUrl.includes('admin.shopify.com/store/')) {
      elements.currentUrl.textContent = `${currentDomain} (Admin)`;
    } else {
      elements.currentUrl.textContent = currentDomain;
    }
    elements.toggleBtn.disabled = false;
    elements.customNameInput.disabled = false;
    elements.saveNameBtn.disabled = false;
    elements.prodColorInput.disabled = false;
    elements.prodColorText.disabled = false;
    elements.saveColorBtn.disabled = false;
    
    // Get store info from storage
    const data = await chrome.storage.local.get(['currentStore', 'overrides', 'customNames', 'globalProductionColor']);
    const overrides = data.overrides || {};
    const customNames = data.customNames || {};
    const globalProductionColor = data.globalProductionColor || '#4B0082';
    
    // Load custom name if exists
    if (customNames[currentDomain]) {
      elements.customNameInput.value = customNames[currentDomain];
    } else {
      elements.customNameInput.value = '';
    }
    
    // Load global production color
    elements.prodColorInput.value = globalProductionColor;
    elements.prodColorText.value = globalProductionColor;
    
    // Determine store type
    let isDev = true; // Default to dev
    if (overrides[currentDomain] !== undefined) {
      isDev = overrides[currentDomain];
    } else if (data.currentStore && data.currentStore.url === currentUrl) {
      isDev = data.currentStore.isDevelopment;
    }
    
    updateStoreTypeDisplay(isDev);
  }
  
  // Update store type display
  function updateStoreTypeDisplay(isDev) {
    elements.storeType.className = `store-type ${isDev ? 'development' : 'production'}`;
    elements.storeType.querySelector('.type-icon').textContent = isDev ? '🛠️' : '🚀';
    elements.storeType.querySelector('.type-text').textContent = isDev ? 'Development Store' : 'Production Store';
  }
  
  // Load and display overrides list
  async function loadOverridesList() {
    const data = await chrome.storage.local.get('overrides');
    const overrides = data.overrides || {};
    
    if (Object.keys(overrides).length === 0) {
      elements.overridesList.innerHTML = '<p class="no-overrides">No manual overrides set</p>';
      elements.clearAllBtn.disabled = true;
      return;
    }
    
    elements.clearAllBtn.disabled = false;
    elements.overridesList.innerHTML = '';
    
    Object.entries(overrides).forEach(([domain, isDev]) => {
      const item = document.createElement('div');
      item.className = 'override-item';
      
      item.innerHTML = `
        <span class="override-domain" title="${domain}">${domain}</span>
        <span class="override-type ${isDev ? 'dev' : 'prod'}">${isDev ? 'DEV' : 'PROD'}</span>
        <button class="remove-override" data-domain="${domain}">×</button>
      `;
      
      elements.overridesList.appendChild(item);
    });
    
    // Add remove handlers
    elements.overridesList.querySelectorAll('.remove-override').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const domain = e.target.dataset.domain;
        await removeOverride(domain);
      });
    });
  }
  
  // Toggle store type
  elements.toggleBtn.addEventListener('click', async () => {
    if (!currentTabId || !currentDomain) return;
    
    // Send message to content script
    try {
      await chrome.tabs.sendMessage(currentTabId, { action: 'toggleStoreType' });
      // Reload status after toggle
      setTimeout(loadCurrentStatus, 100);
    } catch (error) {
      console.error('Failed to toggle:', error);
    }
  });
  
  
  // Sync color picker with text input
  elements.prodColorInput.addEventListener('input', (e) => {
    elements.prodColorText.value = e.target.value.toUpperCase();
  });
  
  elements.prodColorText.addEventListener('input', (e) => {
    const color = e.target.value;
    if (/^#[0-9A-F]{6}$/i.test(color)) {
      elements.prodColorInput.value = color;
    }
  });
  
  // Save global production color
  elements.saveColorBtn.addEventListener('click', async () => {
    const color = elements.prodColorInput.value;
    await chrome.storage.local.set({ globalProductionColor: color });
    
    // Notify ALL tabs to update the color
    const tabs = await chrome.tabs.query({ url: ["https://*.myshopify.com/*", "https://*.shopify.com/*", "https://*.myshopify.io/*"] });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'updateProductionColor', 
          color: color
        });
      } catch {}
    }
    
    // Show feedback
    elements.saveColorBtn.textContent = '✓ Applied';
    setTimeout(() => {
      elements.saveColorBtn.textContent = 'Apply';
    }, 2000);
  });
  
  // Save custom name
  elements.saveNameBtn.addEventListener('click', async () => {
    const customName = elements.customNameInput.value.trim();
    const data = await chrome.storage.local.get('customNames');
    const customNames = data.customNames || {};
    
    if (customName) {
      customNames[currentDomain] = customName;
    } else {
      delete customNames[currentDomain];
    }
    
    await chrome.storage.local.set({ customNames });
    
    // Notify content script to update the navigation
    if (currentTabId) {
      try {
        await chrome.tabs.sendMessage(currentTabId, { 
          action: 'updateCustomName', 
          customName: customName || null
        });
      } catch {}
    }
    
    // Show feedback
    elements.saveNameBtn.textContent = '✓ Saved';
    setTimeout(() => {
      elements.saveNameBtn.textContent = 'Save';
    }, 2000);
  });
  
  // Initial load
  await loadCurrentStatus();
});