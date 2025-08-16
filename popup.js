document.addEventListener('DOMContentLoaded', async () => {
  // Display version from manifest
  const manifest = chrome.runtime.getManifest();
  const versionElement = document.getElementById('version');
  if (versionElement) {
    versionElement.textContent = `v${manifest.version}`;
  }
  
  // Default colors
  const DEFAULT_PROD_COLOR = '#24003D';
  const DEFAULT_DEV_COLOR = '#002407';
  
  const elements = {
    currentUrl: document.getElementById('current-url'),
    toggleBtn: document.getElementById('toggle-btn'),
    customNameInput: document.getElementById('custom-name'),
    saveNameBtn: document.getElementById('save-name'),
    prodColorInput: document.getElementById('prod-color'),
    prodColorText: document.getElementById('prod-color-text'),
    saveProdColorBtn: document.getElementById('save-prod-color'),
    devColorInput: document.getElementById('dev-color'),
    devColorText: document.getElementById('dev-color-text'),
    saveDevColorBtn: document.getElementById('save-dev-color'),
    resetColorsLink: document.getElementById('reset-colors'),
    consoleLoggingCheckbox: document.getElementById('console-logging')
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
      elements.toggleBtn.disabled = true;
      elements.toggleBtn.textContent = 'Not a Shopify Store';
      elements.toggleBtn.className = 'toggle-button disabled';
      elements.customNameInput.disabled = true;
      elements.saveNameBtn.disabled = true;
      elements.prodColorInput.disabled = true;
      elements.prodColorText.disabled = true;
      elements.saveProdColorBtn.disabled = true;
      elements.devColorInput.disabled = true;
      elements.devColorText.disabled = true;
      elements.saveDevColorBtn.disabled = true;
      elements.resetColorsLink.style.pointerEvents = 'none';
      elements.resetColorsLink.style.opacity = '0.5';
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
    elements.saveProdColorBtn.disabled = false;
    elements.devColorInput.disabled = false;
    elements.devColorText.disabled = false;
    elements.saveDevColorBtn.disabled = false;
    elements.resetColorsLink.style.pointerEvents = '';
    elements.resetColorsLink.style.opacity = '';
    
    // Get store info from storage
    const data = await chrome.storage.local.get(['currentStore', 'overrides', 'customNames', 'globalProductionColor', 'globalDevelopmentColor', 'consoleLoggingEnabled']);
    const overrides = data.overrides || {};
    const customNames = data.customNames || {};
    const globalProductionColor = data.globalProductionColor || DEFAULT_PROD_COLOR;
    const globalDevelopmentColor = data.globalDevelopmentColor || DEFAULT_DEV_COLOR;
    const consoleLoggingEnabled = data.consoleLoggingEnabled || false;
    
    // Load custom name if exists
    if (customNames[currentDomain]) {
      elements.customNameInput.value = customNames[currentDomain];
    } else {
      elements.customNameInput.value = '';
    }
    
    // Load global production color
    elements.prodColorInput.value = globalProductionColor;
    elements.prodColorText.value = globalProductionColor;
    
    // Load global development color
    elements.devColorInput.value = globalDevelopmentColor;
    elements.devColorText.value = globalDevelopmentColor.toUpperCase();
    
    // Load console logging setting
    elements.consoleLoggingCheckbox.checked = consoleLoggingEnabled;
    
    // Determine store mode
    let mode = 'default'; // Default to 'default' mode
    if (overrides[currentDomain] !== undefined) {
      // Handle legacy boolean values
      if (typeof overrides[currentDomain] === 'boolean') {
        mode = overrides[currentDomain] ? 'development' : 'production';
      } else {
        mode = overrides[currentDomain];
      }
    } else if (data.currentStore && data.currentStore.url === currentUrl) {
      // Handle both new mode and legacy isDevelopment
      if (data.currentStore.mode) {
        mode = data.currentStore.mode;
      } else if (data.currentStore.isDevelopment !== undefined) {
        mode = data.currentStore.isDevelopment ? 'development' : 'production';
      }
    }
    
    updateStoreTypeDisplay(mode);
  }
  
  // Update store type display
  function updateStoreTypeDisplay(mode) {
    switch(mode) {
      case 'development':
        elements.toggleBtn.textContent = '🛠️  Development Store';
        elements.toggleBtn.className = 'toggle-button development';
        break;
      case 'production':
        elements.toggleBtn.textContent = '🚀  Production Store';
        elements.toggleBtn.className = 'toggle-button production';
        break;
      case 'default':
      default:
        elements.toggleBtn.textContent = '🏪  Default Mode';
        elements.toggleBtn.className = 'toggle-button default';
        break;
    }
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
      // Get console logging setting and only log if enabled
      const data = await chrome.storage.local.get('consoleLoggingEnabled');
      if (data.consoleLoggingEnabled) {
        console.error('Failed to toggle:', error);
      }
    }
  });
  
  
  // Sync color picker with text input for production
  elements.prodColorInput.addEventListener('input', async (e) => {
    elements.prodColorText.value = e.target.value.toUpperCase();
    
    // Send real-time preview to current tab
    if (currentTabId) {
      console.log('[ShopContext] Sending production color preview:', e.target.value, 'to tab:', currentTabId);
      try {
        await chrome.tabs.sendMessage(currentTabId, { 
          action: 'previewStoreColor', 
          colorType: 'production',
          color: e.target.value
        });
      } catch (err) {
        console.error('[ShopContext] Error sending preview:', err);
      }
    } else {
      console.log('[ShopContext] No currentTabId available for preview');
    }
  });
  
  elements.prodColorText.addEventListener('input', async (e) => {
    const color = e.target.value;
    if (/^#[0-9A-F]{6}$/i.test(color)) {
      elements.prodColorInput.value = color;
      
      // Send real-time preview to current tab
      if (currentTabId) {
        try {
          await chrome.tabs.sendMessage(currentTabId, { 
            action: 'previewStoreColor', 
            colorType: 'production',
            color: color
          });
        } catch {}
      }
    }
  });
  
  // Add Enter key support for production color text input
  elements.prodColorText.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.saveProdColorBtn.click();
    }
  });
  
  // Sync color picker with text input for development
  elements.devColorInput.addEventListener('input', async (e) => {
    elements.devColorText.value = e.target.value.toUpperCase();
    
    // Send real-time preview to current tab
    if (currentTabId) {
      console.log('[ShopContext] Sending development color preview:', e.target.value, 'to tab:', currentTabId);
      try {
        await chrome.tabs.sendMessage(currentTabId, { 
          action: 'previewStoreColor', 
          colorType: 'development',
          color: e.target.value
        });
      } catch (err) {
        console.error('[ShopContext] Error sending preview:', err);
      }
    } else {
      console.log('[ShopContext] No currentTabId available for preview');
    }
  });
  
  elements.devColorText.addEventListener('input', async (e) => {
    const color = e.target.value;
    if (/^#[0-9A-F]{6}$/i.test(color)) {
      elements.devColorInput.value = color;
      
      // Send real-time preview to current tab
      if (currentTabId) {
        try {
          await chrome.tabs.sendMessage(currentTabId, { 
            action: 'previewStoreColor', 
            colorType: 'development',
            color: color
          });
        } catch {}
      }
    }
  });
  
  // Add Enter key support for development color text input
  elements.devColorText.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.saveDevColorBtn.click();
    }
  });
  
  // Add Enter key support for custom name input
  elements.customNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.saveNameBtn.click();
    }
  });
  
  // Save global production color
  elements.saveProdColorBtn.addEventListener('click', async () => {
    const color = elements.prodColorInput.value;
    await chrome.storage.local.set({ globalProductionColor: color });
    
    // Notify ALL tabs to update the color
    const tabs = await chrome.tabs.query({ url: ["https://*.myshopify.com/*", "https://*.shopify.com/*", "https://*.myshopify.io/*"] });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'updateStoreColor', 
          colorType: 'production',
          color: color
        });
      } catch {}
    }
    
    // Show feedback without changing button text (to avoid layout shift)
    elements.saveProdColorBtn.style.background = '#00a878';
    setTimeout(() => {
      elements.saveProdColorBtn.style.background = '';
    }, 1000);
  });
  
  // Save global development color
  elements.saveDevColorBtn.addEventListener('click', async () => {
    const color = elements.devColorInput.value;
    await chrome.storage.local.set({ globalDevelopmentColor: color });
    
    // Notify ALL tabs to update the color
    const tabs = await chrome.tabs.query({ url: ["https://*.myshopify.com/*", "https://*.shopify.com/*", "https://*.myshopify.io/*"] });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'updateStoreColor', 
          colorType: 'development',
          color: color
        });
      } catch {}
    }
    
    // Show feedback without changing button text (to avoid layout shift)
    elements.saveDevColorBtn.style.background = '#00a878';
    setTimeout(() => {
      elements.saveDevColorBtn.style.background = '';
    }, 1000);
  });
  
  // Reset both colors to defaults
  elements.resetColorsLink.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Update UI
    elements.prodColorInput.value = DEFAULT_PROD_COLOR;
    elements.prodColorText.value = DEFAULT_PROD_COLOR;
    elements.devColorInput.value = DEFAULT_DEV_COLOR;
    elements.devColorText.value = DEFAULT_DEV_COLOR.toUpperCase();
    
    // Save to storage
    await chrome.storage.local.set({ 
      globalProductionColor: DEFAULT_PROD_COLOR,
      globalDevelopmentColor: DEFAULT_DEV_COLOR
    });
    
    // Notify ALL tabs to update the colors
    const tabs = await chrome.tabs.query({ url: ["https://*.myshopify.com/*", "https://*.shopify.com/*", "https://*.myshopify.io/*"] });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'updateStoreColor', 
          colorType: 'both',
          prodColor: DEFAULT_PROD_COLOR,
          devColor: DEFAULT_DEV_COLOR
        });
      } catch {}
    }
    
    // Show feedback
    const originalText = elements.resetColorsLink.textContent;
    elements.resetColorsLink.textContent = 'Reset!';
    elements.resetColorsLink.style.color = '#00a878';
    setTimeout(() => {
      elements.resetColorsLink.textContent = originalText;
      elements.resetColorsLink.style.color = '';
    }, 1000);
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
    
    // Show feedback without changing button text (to avoid layout shift)
    const originalText = elements.saveNameBtn.textContent;
    elements.saveNameBtn.style.background = '#00a878';
    setTimeout(() => {
      elements.saveNameBtn.style.background = '';
    }, 1000);
  });
  
  // Console logging checkbox handler
  elements.consoleLoggingCheckbox.addEventListener('change', async () => {
    const enabled = elements.consoleLoggingCheckbox.checked;
    await chrome.storage.local.set({ consoleLoggingEnabled: enabled });
    
    // Notify all tabs to update their logging behavior
    const tabs = await chrome.tabs.query({ url: ["https://*.myshopify.com/*", "https://*.shopify.com/*", "https://*.myshopify.io/*"] });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'updateConsoleLogging', 
          enabled: enabled
        });
      } catch {}
    }
  });
  
  // Initial load
  await loadCurrentStatus();
});