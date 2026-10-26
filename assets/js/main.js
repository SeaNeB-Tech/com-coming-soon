/**
 * ============================================================================
 * SeaNeb.com — Homepage Interactive Controller
 * ============================================================================
 * Handles header navigation, dynamic ecosystem products rendering from API,
 * location selection modal, search bar interactions, category filters, and action buttons.
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // State Management
  const state = {
    selectedLocation: 'Anand, Gujarat',
    searchQuery: '',
    isAppMenuOpen: false,
    isLocationDropdownOpen: false,
    isMobileMenuOpen: false,
    products: []
  };

  // DOM Elements
  const header = document.querySelector('.site-header');
  const brandLogoImg = document.getElementById('brand-logo-img') || document.querySelector('.brand-logo-img');
  const heroBrandImg = document.getElementById('hero-brand-img') || document.querySelector('.hero-pin-img');
  const showcaseRow = document.getElementById('products-showcase-row') || document.querySelector('.products-showcase-row');

  const appMenuBtn = document.getElementById('app-menu-btn');
  const ecosystemPopover = document.getElementById('ecosystem-popover');
  const popoverCloseBtn = document.getElementById('popover-close-btn');
  const productGrid = document.getElementById('product-grid');
  
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const searchSuggestions = document.getElementById('search-suggestions');
  
  const locationPickerBtn = document.getElementById('location-picker-btn');
  const locationDropdown = document.getElementById('location-dropdown');
  const currentLocationText = document.getElementById('current-location-text');
  const detectLocationBtn = document.getElementById('detect-location-btn');
  const locationList = document.getElementById('location-list');

  const categoriesContainer = document.getElementById('categories-container');
  const exploreNearbyBtn = document.getElementById('btn-explore-nearby');
  const listBusinessBtn = document.getElementById('btn-list-business');

  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const mobileNavDrawer = document.getElementById('mobile-nav-drawer');
  const toastNotification = document.getElementById('toast-notification');
  const toastMessage = document.getElementById('toast-message');

  // ==========================================================================
  // 1. Toast Notification Utility
  // ==========================================================================
  let toastTimeout = null;
  function showToast(message, duration = 3500) {
    if (!toastNotification || !toastMessage) return;

    toastMessage.textContent = message;
    toastNotification.classList.add('is-visible');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastNotification.classList.remove('is-visible');
    }, duration);
  }

  // ==========================================================================
  // 2. Dynamic Brand Logos & Icons Loader (Central / Dev API & S3 CDN)
  // ==========================================================================
  async function loadBrandLogos() {
    try {
      const brandLogos = await SeaNebAPI.ProductService.getBrandLogos();

      // Dynamically update site header logo
      if (brandLogoImg && brandLogos.headerLogo) {
        brandLogoImg.src = brandLogos.headerLogo;
        brandLogoImg.onerror = function () {
          this.onerror = null;
          this.src = brandLogos.headerLogoFallback || 'assets/images/seaneb-icon.png';
        };
      }

      // Dynamically update hero brand pin/mark
      if (heroBrandImg && brandLogos.heroBrandIcon) {
        heroBrandImg.src = brandLogos.heroBrandIcon;
        heroBrandImg.onerror = function () {
          this.onerror = null;
          this.src = brandLogos.heroBrandIconFallback || 'assets/images/seaneb-icon.png';
        };
      }
    } catch (err) {
      console.warn('[SeaNeb] Error dynamically resolving brand logos:', err);
    }
  }

  // ==========================================================================
  // 3. Dynamic Products Showcase Row (Seaneb App, Seaneb Jobs, Tiffin Service)
  // ==========================================================================
  async function loadShowcaseProducts() {
    if (!showcaseRow) return;

    try {
      const products = await SeaNebAPI.ProductService.getShowcaseProducts();
      if (!products || products.length === 0) return;

      showcaseRow.innerHTML = products.map(product => {
        const iconSrc = product.displayIcon || product.iconUrl || product.logoUrl || product.fallbackIcon;
        const fallbackSrc = product.fallbackIcon || 'assets/images/product-icons/fallback-product.svg';

        return `
          <a href="${escapeHtml(product.url || '#')}" class="showcase-product-card" id="showcase-${escapeHtml(product.key || 'item')}" data-product-key="${escapeHtml(product.key || '')}">
            <div class="showcase-icon-box">
              <img 
                src="${escapeHtml(iconSrc)}" 
                alt="${escapeHtml(product.displayName || product.name)}" 
                class="showcase-icon-img" 
                width="38" 
                height="38" 
                loading="lazy"
                onerror="this.onerror=null; this.src='${escapeHtml(fallbackSrc)}';"
              />
            </div>
            <span class="showcase-product-name">${escapeHtml(product.displayName || product.name)}</span>
          </a>
        `;
      }).join('');

      // Add click notification toast
      showcaseRow.querySelectorAll('.showcase-product-card').forEach(card => {
        card.addEventListener('click', () => {
          const name = card.querySelector('.showcase-product-name')?.textContent || 'Product';
          showToast(`Opening ${name}`);
        });
      });
    } catch (err) {
      console.warn('[SeaNeb] Error loading showcase products from API:', err);
    }
  }

  // ==========================================================================
  // 4. Dynamic Product Ecosystem Integration (9-Dot Grid if present)
  // ==========================================================================
  async function loadEcosystemProducts() {
    if (!productGrid) return;

    // Render skeleton loading state with 3 tiles
    productGrid.innerHTML = `
      <div class="ecosystem-tile-skeleton">
        <div class="skeleton-icon-box"></div>
        <div class="skeleton-name"></div>
      </div>
      <div class="ecosystem-tile-skeleton">
        <div class="skeleton-icon-box"></div>
        <div class="skeleton-name"></div>
      </div>
      <div class="ecosystem-tile-skeleton">
        <div class="skeleton-icon-box"></div>
        <div class="skeleton-name"></div>
      </div>
    `;

    try {
      // Fetch dynamic products via the ProductService
      const products = await SeaNebAPI.ProductService.getProducts();
      state.products = products;
      renderProductGrid(products);
    } catch (err) {
      console.error('[SeaNeb] Failed to load ecosystem products:', err);
      productGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--color-text-muted);">
          <p style="font-weight: 600; margin-bottom: 6px;">Unable to load ecosystem products</p>
          <button id="retry-products-btn" style="font-size: 0.8125rem; color: var(--color-primary); font-weight: 600; text-decoration: underline;">
            Tap to retry
          </button>
        </div>
      `;
      const retryBtn = document.getElementById('retry-products-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', loadEcosystemProducts);
      }
    }
  }

  /**
   * Render dynamic product tiles (3-column layout matching reference)
   * Displays Seaneb App, Seaneb Jobs, Tiffin Service with their logos
   */
  function renderProductGrid(products) {
    if (!productGrid) return;

    if (!products || products.length === 0) {
      productGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--color-text-muted);">
          No products currently available.
        </div>
      `;
      return;
    }

    const fallbackLogo = SeaNebAPI.ProductService.getFallbackLogo();

    productGrid.innerHTML = products.map(product => {
      const isSoon = product.isSoon || (product.badge && product.badge.toLowerCase() === 'soon');

      return `
        <a href="${escapeHtml(product.url || '#')}" class="ecosystem-tile" data-product-id="${escapeHtml(product.id || '')}">
          <div class="tile-icon-box">
            <img 
              src="${escapeHtml(product.logoUrl || fallbackLogo)}" 
              alt="${escapeHtml(product.name || 'Product')}" 
              class="tile-icon-img"
              loading="lazy"
              onerror="this.onerror=null; this.src='${fallbackLogo}';"
            />
          </div>
          <span class="tile-name">${escapeHtml(product.name || 'Product')}</span>
          ${isSoon ? '<span class="tile-soon-badge">Soon</span>' : ''}
        </a>
      `;
    }).join('');

    // Attach click events to handle product navigation or notification
    productGrid.querySelectorAll('.ecosystem-tile').forEach(item => {
      item.addEventListener('click', (e) => {
        const productId = item.getAttribute('data-product-id');
        const product = state.products.find(p => p.id === productId);
        if (product) {
          showToast(`Opening ${product.name}`);
        }
        closeAppMenu();
      });
    });
  }

  // ==========================================================================
  // 3. Nine-Dot Ecosystem Menu Controls
  // ==========================================================================
  function openAppMenu() {
    state.isAppMenuOpen = true;
    if (ecosystemPopover) ecosystemPopover.classList.add('is-open');
    if (appMenuBtn) appMenuBtn.setAttribute('aria-expanded', 'true');
    closeLocationDropdown();
  }

  function closeAppMenu() {
    state.isAppMenuOpen = false;
    if (ecosystemPopover) ecosystemPopover.classList.remove('is-open');
    if (appMenuBtn) appMenuBtn.setAttribute('aria-expanded', 'false');
  }

  if (appMenuBtn) {
    appMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.isAppMenuOpen) {
        closeAppMenu();
      } else {
        openAppMenu();
      }
    });
  }

  if (popoverCloseBtn) {
    popoverCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAppMenu();
    });
  }

  // ==========================================================================
  // 4. Location Selector Controls
  // ==========================================================================
  async function populateLocationList() {
    if (!locationList) return;

    try {
      const locations = await SeaNebAPI.LocationService.getLocations();
      locationList.innerHTML = locations.map(loc => {
        const fullLocation = `${loc.name}, ${loc.state}`;
        const isSelected = state.selectedLocation.toLowerCase() === fullLocation.toLowerCase();

        return `
          <li>
            <button type="button" class="location-option-btn ${isSelected ? 'selected' : ''}" data-location="${escapeHtml(fullLocation)}">
              <span>${escapeHtml(loc.name)}</span>
              <span class="location-state-tag">${escapeHtml(loc.state)}</span>
            </button>
          </li>
        `;
      }).join('');

      locationList.querySelectorAll('.location-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const loc = btn.getAttribute('data-location');
          selectLocation(loc);
        });
      });
    } catch (err) {
      console.error('Error populating locations:', err);
    }
  }

  function selectLocation(locationString) {
    state.selectedLocation = locationString;
    if (currentLocationText) {
      currentLocationText.textContent = locationString;
    }
    closeLocationDropdown();
    showToast(`Location set to ${locationString}`);
    populateLocationList();
  }

  function openLocationDropdown() {
    state.isLocationDropdownOpen = true;
    if (locationDropdown) locationDropdown.classList.add('is-open');
    if (locationPickerBtn) locationPickerBtn.setAttribute('aria-expanded', 'true');
    closeAppMenu();
  }

  function closeLocationDropdown() {
    state.isLocationDropdownOpen = false;
    if (locationDropdown) locationDropdown.classList.remove('is-open');
    if (locationPickerBtn) locationPickerBtn.setAttribute('aria-expanded', 'false');
  }

  if (locationPickerBtn) {
    locationPickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.isLocationDropdownOpen) {
        closeLocationDropdown();
      } else {
        openLocationDropdown();
      }
    });
  }

  if (detectLocationBtn) {
    detectLocationBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      detectLocationBtn.classList.add('loading');
      detectLocationBtn.setAttribute('disabled', 'true');

      try {
        const detected = await SeaNebAPI.LocationService.detectCurrentLocation();
        selectLocation(`${detected.name} (Anand Area)`);
      } catch (err) {
        console.warn('Geolocation detection:', err.message);
        selectLocation('Anand, Gujarat');
      } finally {
        detectLocationBtn.classList.remove('loading');
        detectLocationBtn.removeAttribute('disabled');
      }
    });
  }

  // ==========================================================================
  // 5. Search Bar Functionality
  // ==========================================================================
  if (searchForm) {
    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = (searchInput.value || '').trim();
      const location = state.selectedLocation;

      closeSearchSuggestions();
      closeLocationDropdown();
      closeAppMenu();

      if (!query) {
        showToast(`Searching all businesses in ${location}...`);
      } else {
        showToast(`Searching for "${query}" in ${location}...`);
      }

      try {
        const response = await SeaNebAPI.SearchService.search(query, location);
        console.info('[SeaNeb Search Result]:', response);
      } catch (err) {
        console.error('Search error:', err);
      }
    });
  }

  // Search input live suggestions
  if (searchInput && searchSuggestions) {
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim().length > 0) {
        openSearchSuggestions();
      }
    });

    searchInput.addEventListener('input', () => {
      if (searchInput.value.trim().length > 0) {
        openSearchSuggestions();
      } else {
        closeSearchSuggestions();
      }
    });

    searchSuggestions.querySelectorAll('.suggestion-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-value') || btn.textContent.trim();
        searchInput.value = val;
        closeSearchSuggestions();
        searchForm.requestSubmit();
      });
    });
  }

  function openSearchSuggestions() {
    searchSuggestions.classList.add('is-open');
  }

  function closeSearchSuggestions() {
    if (searchSuggestions) {
      searchSuggestions.classList.remove('is-open');
    }
  }

  // ==========================================================================
  // 6. Category Icons Interactions
  // ==========================================================================
  if (categoriesContainer) {
    categoriesContainer.querySelectorAll('.category-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const categoryQuery = card.getAttribute('data-category-query') || card.querySelector('.category-label').textContent.trim();
        
        if (searchInput) {
          searchInput.value = categoryQuery;
        }

        showToast(`Exploring ${categoryQuery} in ${state.selectedLocation}`);
        
        // Trigger simulated search query for this category
        SeaNebAPI.SearchService.search(categoryQuery, state.selectedLocation);
      });
    });
  }

  // ==========================================================================
  // 7. Bottom Primary Action Buttons
  // ==========================================================================
  if (exploreNearbyBtn) {
    exploreNearbyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast(`Discovering popular places near ${state.selectedLocation}...`);
      SeaNebAPI.SearchService.search('', state.selectedLocation);
    });
  }

  if (listBusinessBtn) {
    listBusinessBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Opening SeaNeb Merchant Center — Grow your business locally!');
    });
  }

  // ==========================================================================
  // 8. Mobile Navigation Drawer
  // ==========================================================================
  if (mobileMenuToggle && mobileNavDrawer) {
    mobileMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      state.isMobileMenuOpen = !state.isMobileMenuOpen;
      
      mobileMenuToggle.classList.toggle('is-active', state.isMobileMenuOpen);
      mobileNavDrawer.classList.toggle('is-open', state.isMobileMenuOpen);
      mobileMenuToggle.setAttribute('aria-expanded', state.isMobileMenuOpen ? 'true' : 'false');
    });

    mobileNavDrawer.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        state.isMobileMenuOpen = false;
        mobileMenuToggle.classList.remove('is-active');
        mobileNavDrawer.classList.remove('is-open');
        mobileMenuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ==========================================================================
  // 9. Global Click-Outside & Keyboard Escape Handling
  // ==========================================================================
  document.addEventListener('click', (e) => {
    // If click was outside popover and app button, close popover
    if (state.isAppMenuOpen && !ecosystemPopover.contains(e.target) && !appMenuBtn.contains(e.target)) {
      closeAppMenu();
    }

    // If click was outside location dropdown and picker button, close location dropdown
    if (state.isLocationDropdownOpen && locationDropdown && locationPickerBtn && !locationDropdown.contains(e.target) && !locationPickerBtn.contains(e.target)) {
      closeLocationDropdown();
    }

    // If click was outside search form, close search suggestions
    if (searchSuggestions && searchForm && !searchForm.contains(e.target)) {
      closeSearchSuggestions();
    }

    // If click was outside mobile menu drawer and hamburger button
    if (state.isMobileMenuOpen && !mobileNavDrawer.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
      state.isMobileMenuOpen = false;
      mobileMenuToggle.classList.remove('is-active');
      mobileNavDrawer.classList.remove('is-open');
      mobileMenuToggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAppMenu();
      closeLocationDropdown();
      closeSearchSuggestions();
    }
  });

  // Header elevation on scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });

  // Helper utility: XSS safe escaping
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Boot
  loadBrandLogos();
  loadShowcaseProducts();
  loadEcosystemProducts();
  populateLocationList();
});
