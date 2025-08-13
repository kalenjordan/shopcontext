(() => {
  console.log('[Shop Context] Extension loaded');
  let currentStoreType = null;

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
        console.log('[Shop Context] Custom name already present, removing for update');
        document.getElementById('shop-context-custom-name').remove();
      }
      await injectCustomStoreNameInternal(retryCount);
      return;
    }

    // Debounce - wait a bit to let any other calls settle
    injectCustomNameTimeout = setTimeout(async () => {
      // Check if custom name already exists
      if (document.getElementById('shop-context-custom-name')) {
        console.log('[Shop Context] Custom name already present, skipping');
        return;
      }

      await injectCustomStoreNameInternal(retryCount);
    }, 100); // 100ms debounce
  }

  async function injectCustomStoreNameInternal(retryCount = 0) {
    console.log(`[Shop Context] Waiting for navigation to be ready, retry: ${retryCount}`);

    // Get custom name from storage
    const domain = getCurrentDomain();
    const data = await chrome.storage.local.get('customNames');
    const customNames = data.customNames || {};
    const customName = customNames[domain];

    console.log(`[Shop Context] Custom name for ${domain}: ${customName}`);

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
        console.log('[Shop Context] Sales channels not found, navigation not ready yet...');
        setTimeout(() => injectCustomStoreNameInternal(retryCount + 1), 500);
      } else {
        console.log('[Shop Context] Sales channels never appeared after 30 retries, trying to inject anyway');
        // Fall back to original logic if Sales channels never appears
        const homeLink = document.querySelector('a[href*="/store/"][class*="Navigation__Item"]') ||
                         document.querySelector('a[href*="/admin"][class*="Navigation__Item"]') ||
                         document.querySelector('.Polaris-Navigation__Item');
        if (homeLink) {
          console.log('[Shop Context] Found navigation without Sales channels, proceeding with injection');
          // Continue with the injection logic below
        } else {
          return;
        }
      }
      if (retryCount < 30) return;
    } else {
      console.log('[Shop Context] Sales channels found, navigation is ready');
    }

    // Find the navigation by looking for the Home link
    const homeLink = document.querySelector('a[href*="/store/"][class*="Navigation__Item"]') ||
                     document.querySelector('a[href*="/admin"][class*="Navigation__Item"]') ||
                     document.querySelector('.Polaris-Navigation__Item');

    if (!homeLink) {
      console.log('[Shop Context] Home link not found even though Sales channels is present');
      return;
    }

    // Find the list item containing the home link
    let homeItem = homeLink.closest('li');
    if (!homeItem) {
      console.log('[Shop Context] Could not find home list item');
      return;
    }

    // Get the parent list
    const navList = homeItem.parentElement;
    if (!navList) {
      console.log('[Shop Context] Could not find navigation list');
      return;
    }

    console.log('[Shop Context] Found navigation, inserting custom name');

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

  // Function to apply visual indicators based on store type
  async function applyStoreTypeIndicators(isDev, retryCount = 0) {
    console.log(`[Shop Context] Applying indicators - isDev: ${isDev}, retry: ${retryCount}`);

    // Get global production color from storage
    const data = await chrome.storage.local.get('globalProductionColor');
    const customColor = data.globalProductionColor || '#4B0082';

    console.log(`[Shop Context] Global production color: ${customColor}`);

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
        console.log('[Shop Context] Found ClickMask with class:', element.className);
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

    console.log(`[Shop Context] ClickMask found: ${!!clickMask}, TopBar found: ${!!topBar}`);

    // If ClickMask not found and we haven't retried too many times, retry after a delay
    // We'll retry more times for ClickMask since it appears later
    if (!clickMask && retryCount < 20) {
      console.log(`[Shop Context] ClickMask not found, retrying in 500ms... (attempt ${retryCount + 1}/20)`);
      setTimeout(() => applyStoreTypeIndicators(isDev, retryCount + 1), 500);
      return;
    }

    // Remove existing styling from all potential elements
    document.querySelectorAll('[class*="ClickMask"], [class*="TopBar"]').forEach(el => {
      el.style.removeProperty('background-color');
      el.style.removeProperty('background');
      el.classList.remove('shopify-prod-header');
    });

    // If production store, add custom color
    if (!isDev) {
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
        clickMask.classList.add('shopify-prod-header');
        console.log(`[Shop Context] Applied production color to ClickMask: ${bgColor}`);
      }

      // Also apply to TopBar as fallback
      if (topBar && !clickMask) {
        topBar.style.setProperty('background-color', bgColor, 'important');
        topBar.classList.add('shopify-prod-header');
        console.log(`[Shop Context] Applied production color to TopBar (fallback): ${bgColor}`);
      }
    }

    currentStoreType = isDev;
  }

  // Toggle store type
  async function toggleStoreType() {
    const newType = !currentStoreType;
    const domain = getCurrentDomain();

    // Save override
    const data = await chrome.storage.local.get('overrides');
    const overrides = data.overrides || {};
    overrides[domain] = newType;
    await chrome.storage.local.set({ overrides });

    // Update visual indicators
    applyStoreTypeIndicators(newType);

    // Update storage
    chrome.storage.local.set({
      currentStore: {
        url: window.location.href,
        isDevelopment: newType,
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
    console.log('[Shop Context] Initializing...');

    if (!isShopifyStore()) {
      console.log('[Shop Context] Not a Shopify store, extension inactive');
      return;
    }

    // Check for saved state for this store
    const domain = getCurrentDomain();
    const savedState = await getManualOverride();
    let isDev = true; // Default to dev

    if (savedState !== undefined) {
      isDev = savedState;
    }

    console.log(`[Shop Context] Store: ${domain}, Type: ${isDev ? 'Development' : 'Production'}`);

    // Apply indicators with a small delay to ensure DOM is ready
    setTimeout(() => applyStoreTypeIndicators(isDev), 100);
    injectCustomStoreName();

    // Store the detection result
    chrome.storage.local.set({
      currentStore: {
        url: window.location.href,
        isDevelopment: isDev,
        timestamp: Date.now()
      }
    });
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleStoreType') {
      toggleStoreType();
    } else if (request.action === 'setStoreType') {
      applyStoreTypeIndicators(request.isDevelopment);
      // Update storage
      chrome.storage.local.set({
        currentStore: {
          url: window.location.href,
          isDevelopment: request.isDevelopment,
          timestamp: Date.now()
        }
      });
    } else if (request.action === 'reloadIndicator') {
      init();
    } else if (request.action === 'updateCustomName') {
      // Use immediate mode for instant update
      injectCustomStoreName(0, true);
    } else if (request.action === 'updateProductionColor') {
      // Re-apply the indicators with the new color
      applyStoreTypeIndicators(currentStoreType);
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

    // Check if Sales channels button appears and custom name is missing
    const salesChannelsExists = Array.from(document.querySelectorAll('button')).find(btn => {
      const text = btn.textContent || btn.innerText;
      return text && text.includes('Sales channels');
    }) || Array.from(document.querySelectorAll('span')).find(span => {
      const text = span.textContent || span.innerText;
      return text && text.trim() === 'Sales channels';
    })?.closest('button');
    
    if (!document.getElementById('shop-context-custom-name') && salesChannelsExists) {
      console.log('[Shop Context] Sales channels appeared, injecting custom name');
      injectCustomStoreName();
    }
  }).observe(document, { subtree: true, childList: true });
})();
