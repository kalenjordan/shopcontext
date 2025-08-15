(() => {
  let currentStoreMode = 'default'; // 'default', 'development', or 'production'
  let consoleLoggingEnabled = false;

  // Helper function for conditional logging
  function log(...args) {
    if (consoleLoggingEnabled) {
      console.log(...args);
    }
  }

  // Get domain from current URL
  function getCurrentDomain() {
    // For admin.shopify.com URLs, extract the store handle from the path
    if (window.location.hostname === 'admin.shopify.com') {
      const pathMatch = window.location.pathname.match(/^\/store\/([^\/]+)/);
      if (pathMatch && pathMatch[1]) {
        return pathMatch[1]; // Returns the store handle (e.g., "kalen-test-store")
      }
    }
    return window.location.hostname;
  }

  // Check for manual override
  async function getManualOverride() {
    const domain = getCurrentDomain();
    const data = await chrome.storage.local.get('overrides');
    const overrides = data.overrides || {};
    return overrides[domain];
  }


  // Function to inject custom store name into navigation
  let injectCustomNameTimeout = null;
  async function injectCustomStoreName(retryCount = 0, immediate = false) {
    // Clear any pending injections
    if (injectCustomNameTimeout) {
      clearTimeout(injectCustomNameTimeout);
    }

    // If immediate flag is set, skip debounce (used for updates from popup)
    if (immediate) {
      // Check if custom name already exists
      if (document.getElementById('shop-context-custom-name')) {
          document.getElementById('shop-context-custom-name').remove();
      }
      await injectCustomStoreNameInternal(retryCount);
      return;
    }

    // Debounce - wait a bit to let any other calls settle
    injectCustomNameTimeout = setTimeout(async () => {
      // Check if custom name already exists
      if (document.getElementById('shop-context-custom-name')) {
        return;
      }

      await injectCustomStoreNameInternal(retryCount);
    }, 100); // 100ms debounce
  }

  async function injectCustomStoreNameInternal(retryCount = 0) {
    // Get custom name from storage
    const domain = getCurrentDomain();
    const data = await chrome.storage.local.get('customNames');
    const customNames = data.customNames || {};
    const customName = customNames[domain];

    if (!customName) return;

    // Wait for Sales channels button to ensure navigation is fully loaded
    // Try multiple methods to find the Sales channels button
    let salesChannelsButton = Array.from(document.querySelectorAll('button')).find(btn => {
      const text = btn.textContent || btn.innerText;
      return text && text.includes('Sales channels');
    });
    
    // Also check for the span specifically
    if (!salesChannelsButton) {
      const salesChannelsSpan = Array.from(document.querySelectorAll('span')).find(span => {
        const text = span.textContent || span.innerText;
        return text && text.trim() === 'Sales channels';
      });
      if (salesChannelsSpan) {
        salesChannelsButton = salesChannelsSpan.closest('button');
      }
    }

    if (!salesChannelsButton) {
      if (retryCount < 30) { // Increased retry count since we're waiting for full load
        setTimeout(() => injectCustomStoreNameInternal(retryCount + 1), 500);
      } else {
        // Fall back to original logic if Sales channels never appears
        const homeLink = document.querySelector('a[href*="/store/"][class*="Navigation__Item"]') ||
                         document.querySelector('a[href*="/admin"][class*="Navigation__Item"]') ||
                         document.querySelector('.Polaris-Navigation__Item');
        if (homeLink) {
          // Continue with the injection logic below
        } else {
          return;
        }
      }
      if (retryCount < 30) return;
    } else {
    }

    // Find the navigation by looking for the Home link
    const homeLink = document.querySelector('a[href*="/store/"][class*="Navigation__Item"]') ||
                     document.querySelector('a[href*="/admin"][class*="Navigation__Item"]') ||
                     document.querySelector('.Polaris-Navigation__Item');

    if (!homeLink) {
      return;
    }

    // Find the list item containing the home link
    let homeItem = homeLink.closest('li');
    if (!homeItem) {
      return;
    }

    // Get the parent list
    const navList = homeItem.parentElement;
    if (!navList) {
      return;
    }


    // Create custom name menu item - match native navigation style
    const customNameItem = document.createElement('li');
    customNameItem.id = 'shop-context-custom-name';
    customNameItem.className = homeItem.className || 'Polaris-Navigation__ListItem';

    // Clone the Home item's structure but modify the content
    const homeWrapper = homeItem.querySelector('[class*="ItemWrapper"]');
    const homeInnerWrapper = homeItem.querySelector('[class*="ItemInnerWrapper"]');

    // Remove selected state from classes if present
    const wrapperClass = homeWrapper?.className || 'Polaris-Navigation__ItemWrapper';
    let innerWrapperClass = homeInnerWrapper?.className || 'Polaris-Navigation__ItemInnerWrapper';
    innerWrapperClass = innerWrapperClass.replace('Polaris-Navigation__ItemInnerWrapper--selected', 'Polaris-Navigation__ItemInnerWrapper');

    customNameItem.innerHTML = `
      <div class="${wrapperClass}">
        <div class="${innerWrapperClass}">
          <div class="Polaris-Navigation__Item" style="cursor: pointer;">
            <div class="Polaris-Navigation__Icon">
              <span class="Polaris-Icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" class="Polaris-Icon__Svg" focusable="false" aria-hidden="true">
                  <path d="M12.278 3a2.75 2.75 0 0 1 2.162 1.051l2.16 2.75.01.013c.736 1.03.238 2.396-.831 2.811h-1.17c-.475 0-.915-.244-1.166-.646l-.663-1.06a.624.624 0 0 0-1.137.184l-.075.298a1.616 1.616 0 0 1-3.136 0l-.075-.298a.628.628 0 0 0-.637-.477.624.624 0 0 0-.5.293l-.662 1.06a1.375 1.375 0 0 1-1.166.646h-1.17c-1.07-.415-1.568-1.781-.832-2.81l.01-.015 2.16-2.749a2.75 2.75 0 0 1 2.162-1.051h4.556Z"/>
                  <path fill-rule="evenodd" d="M4.5 10.875v4.375c0 .966.784 1.75 1.75 1.75h7.5a1.75 1.75 0 0 0 1.75-1.75v-4.375h-.892a2.625 2.625 0 0 1-2.226-1.234l-.012-.02a2.866 2.866 0 0 1-4.74 0l-.012.02a2.625 2.625 0 0 1-2.226 1.234h-.892Zm8.5 2.475a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1v2.4c0 .138.112.25.25.25h2.5a.25.25 0 0 0 .25-.25v-2.4Z"/>
                </svg>
              </span>
            </div>
            <span class="Polaris-Navigation__Text">
              <span class="Polaris-Text--root Polaris-Text--bodyMd Polaris-Text--semibold">
                ${customName}
              </span>
            </span>
          </div>
        </div>
      </div>
    `;

    // Add click handler to open extension popup
    customNameItem.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });

    // Insert before the Home item
    navList.insertBefore(customNameItem, homeItem);
  }

  // Store the original logo HTML
  let originalLogoHTML = null;

  // Function to replace Shopify logo with shop name or restore it
  async function replaceLogoWithShopName() {
    // Find the logo wrapper
    const logoWrapper = document.querySelector('[class*="_ShopifyLogoWrapper"]');
    if (!logoWrapper) {
      log('[Shop Context] Logo wrapper not found');
      return;
    }

    // Save the original logo HTML if we haven't already
    if (!originalLogoHTML && !logoWrapper.querySelector('#shop-context-custom-logo')) {
      originalLogoHTML = logoWrapper.innerHTML;
    }

    // Get custom name from storage
    const domain = getCurrentDomain();
    const data = await chrome.storage.local.get('customNames');
    const customNames = data.customNames || {};
    const customName = customNames[domain];

    // If there's a custom name, show it
    if (customName && customName.trim() !== '') {
      log(`[Shop Context] Replacing logo with custom name: ${customName}`);
      
      // Replace the logo wrapper content with custom name text
      logoWrapper.innerHTML = `
        <div id="shop-context-custom-logo" style="
          display: flex;
          align-items: center;
          height: 100%;
          color: var(--p-color-text);
          font-size: 16px;
          font-weight: 600;
          white-space: nowrap;
        ">
          ${customName}
        </div>
      `;
    } else {
      // No custom name - restore the original Shopify logo if it was replaced
      if (logoWrapper.querySelector('#shop-context-custom-logo') && originalLogoHTML) {
        log('[Shop Context] Restoring original Shopify logo');
        logoWrapper.innerHTML = originalLogoHTML;
      }
    }
  }

  // Function to apply visual indicators based on store mode
  async function applyStoreTypeIndicators(mode, retryCount = 0) {
    // Get global colors from storage
    const data = await chrome.storage.local.get(['globalProductionColor', 'globalDevelopmentColor']);
    const prodColor = data.globalProductionColor || '#24003D';
    const devColor = data.globalDevelopmentColor || '#002407';
    
    // Determine which color to use based on mode
    let customColor = null;
    if (mode === 'development') {
      customColor = devColor;
    } else if (mode === 'production') {
      customColor = prodColor;
    }
    // If mode is 'default', customColor remains null and no styling will be applied

    // Convert hex to rgba with opacity
    const hexToRgba = (hex, opacity) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    };

    // Find the TopBar first
    let topBar = document.querySelector('[class*="TopBar"][class*="_TopBar_"]');
    if (!topBar) {
      topBar = document.querySelector('[class*="TopBar"]');
    }
    if (!topBar) {
      const themeContainers = document.querySelectorAll('.Polaris-ThemeProvider--themeContainer, .themeprovider');
      for (const container of themeContainers) {
        const firstChild = container.firstElementChild;
        if (firstChild && firstChild.className && firstChild.className.includes('TopBar')) {
          topBar = firstChild;
          break;
        }
      }
    }

    // Find the ClickMask element - search more thoroughly
    let clickMask = null;

    // Strategy 1: Look for any element with ClickMask in its class
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      if (element.className && typeof element.className === 'string' && element.className.includes('ClickMask')) {
        clickMask = element;
        break;
      }
    }

    // Strategy 2: If TopBar exists, check its children and siblings more thoroughly
    if (!clickMask && topBar) {
      // Check all descendants
      const descendants = topBar.querySelectorAll('*');
      for (const desc of descendants) {
        if (desc.className && typeof desc.className === 'string' && desc.className.includes('ClickMask')) {
          clickMask = desc;
          break;
        }
      }

      // Check siblings
      if (!clickMask && topBar.parentElement) {
        const siblings = topBar.parentElement.querySelectorAll('*');
        for (const sibling of siblings) {
          if (sibling.className && typeof sibling.className === 'string' && sibling.className.includes('ClickMask')) {
            clickMask = sibling;
            break;
          }
        }
      }
    }

    // If ClickMask not found and we haven't retried too many times, retry after a delay
    // We'll retry more times for ClickMask since it appears later
    if (!clickMask && retryCount < 20) {
      setTimeout(() => applyStoreTypeIndicators(mode, retryCount + 1), 500);
      return;
    }

    // Remove existing styling from all potential elements
    document.querySelectorAll('[class*="ClickMask"], [class*="TopBar"]').forEach(el => {
      el.style.removeProperty('background-color');
      el.style.removeProperty('background');
      el.classList.remove('shopify-prod-header');
      el.classList.remove('shopify-dev-header');
    });

    // Apply custom color only if not in default mode
    if (customColor && mode !== 'default') {
      const bgColor = hexToRgba(customColor, 0.85);

      // Apply to ClickMask if found (preferred)
      if (clickMask) {
        clickMask.style.setProperty('background-color', bgColor, 'important');
        clickMask.style.setProperty('pointer-events', 'none', 'important');
        clickMask.style.setProperty('position', 'absolute', 'important');
        clickMask.style.setProperty('top', '0', 'important');
        clickMask.style.setProperty('left', '0', 'important');
        clickMask.style.setProperty('right', '0', 'important');
        clickMask.style.setProperty('bottom', '0', 'important');
        // clickMask.style.setProperty('z-index', '1', 'important');
        clickMask.classList.add(mode === 'development' ? 'shopify-dev-header' : 'shopify-prod-header');
      }

      // Also apply to TopBar as fallback
      if (topBar && !clickMask) {
        topBar.style.setProperty('background-color', bgColor, 'important');
        topBar.classList.add(mode === 'development' ? 'shopify-dev-header' : 'shopify-prod-header');
      }
    }

    currentStoreMode = mode;
  }

  // Toggle store mode (cycles through default -> development -> production)
  async function toggleStoreType() {
    let newMode;
    
    // Cycle through the modes
    switch(currentStoreMode) {
      case 'default':
        newMode = 'development';
        break;
      case 'development':
        newMode = 'production';
        break;
      case 'production':
        newMode = 'default';
        break;
      default:
        newMode = 'default';
    }
    
    const domain = getCurrentDomain();

    // Save override
    const data = await chrome.storage.local.get('overrides');
    const overrides = data.overrides || {};
    overrides[domain] = newMode;
    await chrome.storage.local.set({ overrides });

    // Update visual indicators
    applyStoreTypeIndicators(newMode);

    // Update storage
    chrome.storage.local.set({
      currentStore: {
        url: window.location.href,
        mode: newMode,
        timestamp: Date.now()
      }
    });
  }

  // Function to check if we're on a Shopify store
  function isShopifyStore() {
    // Check various Shopify indicators
    return window.Shopify !== undefined ||
           document.querySelector('meta[name="shopify-checkout-api-token"]') ||
           document.querySelector('script[src*="cdn.shopify.com"]') ||
           window.location.hostname.includes('myshopify.com') ||
           window.location.hostname.includes('myshopify.io') ||
           window.location.hostname.includes('shopify.com');
  }

  // Function to initialize the extension
  async function init() {
    if (!isShopifyStore()) {
      return;
    }

    // Load console logging setting
    const loggingData = await chrome.storage.local.get('consoleLoggingEnabled');
    consoleLoggingEnabled = loggingData.consoleLoggingEnabled || false;

    // Check for saved state for this store
    const domain = getCurrentDomain();
    const savedState = await getManualOverride();
    let mode = 'default'; // Default to 'default' mode (no visual changes)

    if (savedState !== undefined) {
      // Handle legacy boolean values
      if (typeof savedState === 'boolean') {
        mode = savedState ? 'development' : 'production';
      } else {
        mode = savedState;
      }
    }

    // Apply indicators with a small delay to ensure DOM is ready
    setTimeout(() => applyStoreTypeIndicators(mode), 100);
    
    // Replace Shopify logo with shop name
    setTimeout(() => replaceLogoWithShopName(), 200);

    // Store the detection result
    chrome.storage.local.set({
      currentStore: {
        url: window.location.href,
        mode: mode,
        timestamp: Date.now()
      }
    });
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleStoreType') {
      toggleStoreType();
    } else if (request.action === 'setStoreMode') {
      applyStoreTypeIndicators(request.mode);
      currentStoreMode = request.mode;
      // Update storage
      chrome.storage.local.set({
        currentStore: {
          url: window.location.href,
          mode: request.mode,
          timestamp: Date.now()
        }
      });
    } else if (request.action === 'reloadIndicator') {
      init();
    } else if (request.action === 'updateCustomName') {
      // Update the logo immediately with the new custom name
      replaceLogoWithShopName();
    } else if (request.action === 'updateProductionColor' || request.action === 'updateStoreColor') {
      // Re-apply the indicators with the new color
      applyStoreTypeIndicators(currentStoreMode);
    } else if (request.action === 'updateConsoleLogging') {
      consoleLoggingEnabled = request.enabled;
    }
    sendResponse({ success: true });
  });

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-run on page navigation (for SPAs)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(init, 1000); // Wait a bit for page to load
    }

    // Check if logo needs to be replaced or updated with custom name
    const logoWrapper = document.querySelector('[class*="_ShopifyLogoWrapper"]');
    if (logoWrapper) {
      // Only replace if it doesn't already have our custom logo or if we need to check for updates
      if (!logoWrapper.querySelector('#shop-context-custom-logo')) {
        replaceLogoWithShopName();
      }
    }
  }).observe(document, { subtree: true, childList: true });
})();
