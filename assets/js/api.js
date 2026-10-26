/**
 * ============================================================================
 * SeaNeb.com — Client API Service & Integration Module
 * ============================================================================
 * 
 * ARCHITECTURE OVERVIEW:
 * ----------------------
 * Backend API  ──▶  ProductService  ──▶  Product Data Model
 *                     │
 *                     ▼
 *           Product Logo Component / Nine-Dot Application Menu
 * 
 * This module manages all asynchronous data interactions for SeaNeb.com.
 * Product logos and metadata are dynamically loaded and rendered. No product
 * cards are hardcoded into HTML, ensuring any backend change (adding, removing,
 * renaming products) reflects seamlessly across the UI without frontend code edits.
 * 
 * CONFIGURATION POINTS:
 * --------------------
 * Update `API_CONFIG.BASE_URL` or inject `window.__SEANEB_API_BASE_URL__` to point
 * to your live staging or production backend services.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SeaNebAPI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Global API Configuration
   * MARKED CONFIGURATION POINT: Configures backend endpoint URLs & DigitalOcean Spaces S3 CDN.
   */
  const API_CONFIG = {
    // Primary API URLs provided by backend services / environment:
    DEV_URL: (typeof window !== 'undefined' && window.__SEANEB_DEV_URL__) 
      || 'https://dev.seaneb.com',
    CENTRAL_URL: (typeof window !== 'undefined' && window.__SEANEB_CENTRAL_URL__) 
      || 'https://central-api.seaneb.com',
    S3_BASE_URL: (typeof window !== 'undefined' && window.__SEANEB_S3_BASE_URL__) 
      || 'https://seaneb-bucket.blr1.digitaloceanspaces.com',

    // Current active API BASE_URL (defaults to DEV_URL since dev.seaneb.com supports browser CORS directly)
    get BASE_URL() {
      if (typeof window !== 'undefined' && window.__SEANEB_API_BASE_URL__) {
        return window.__SEANEB_API_BASE_URL__;
      }
      return this.DEV_URL;
    },

    // Service endpoints
    ENDPOINTS: {
      PRODUCTS_NINEDOTS: '/api/v1/products/ninedots',
      PRODUCTS: '/api/v1/products',
      SEARCH: '/api/v1/search',
      LOCATIONS: '/api/v1/public/locations',
      CATEGORIES: '/api/v1/public/categories'
    },

    // Request timeout in milliseconds
    TIMEOUT_MS: 5000,

    // When backend endpoint is not yet deployed, fallback seamlessly to demo data
    ENABLE_FALLBACK_DATA: true,

    // Fallback neutral product icon to prevent broken images
    FALLBACK_LOGO_URL: 'assets/images/product-icons/fallback-product.svg'
  };

  /**
   * Helper utility to resolve relative media paths to absolute S3 bucket URLs
   * @param {string} path 
   * @returns {string}
   */
  function resolveMediaUrl(path) {
    if (!path || typeof path !== 'string') return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('assets/')) {
      return path;
    }
    const cleanPath = path.replace(/^\/+/, '');
    return `${API_CONFIG.S3_BASE_URL}/${cleanPath}`;
  }

  /**
   * Known local asset fallbacks for core ecosystem products
   */
  const LOCAL_FALLBACKS = {
    'seaneb': 'assets/images/product-icons/seaneb-icon.png',
    'jobs': 'assets/images/product-icons/jobs.svg',
    'tiffin': 'assets/images/product-icons/tiffin.svg',
    'auto': 'assets/images/product-icons/fallback-product.svg'
  };

  /**
   * Canonical public domains for ecosystem products
   */
  const CANONICAL_URLS = {
    'seaneb': 'https://seaneb.com',
    'jobs': 'https://jobs.seaneb.com',
    'tiffin': 'https://www.tiffinservice.app',
    'auto': 'https://auto.seaneb.com',
    'property': 'https://property.seaneb.com',
    'news': 'https://news.seaneb.com'
  };

  /**
   * Helper utility for HTTP requests with timeouts and standard headers
   * @param {string} url 
   * @param {object} options 
   * @returns {Promise<any>}
   */
  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Default Ecosystem Products Dataset (Fallback & Specification Reference)
   */
  const DEFAULT_ECOSYSTEM_PRODUCTS = [
    {
      product_key: 'seaneb',
      name: 'Seaneb App',
      tagline: 'Hyperlocal business, product & service discovery',
      icon: 'https://www.seaneb.com/images/logo/apple-touch-icon.png',
      logo: 'https://www.seaneb.com/images/logo/apple-touch-icon.png',
      url: 'https://seaneb.com',
      badge: 'Active'
    },
    {
      product_key: 'jobs',
      name: 'Seaneb Jobs',
      tagline: 'Discover local jobs and career opportunities',
      icon: 'in/product/jobs/favicon/jobs-favicon.webp',
      logo: 'in/product/jobs/logo/jobs-logo.webp',
      url: 'https://jobs.seaneb.com',
      badge: 'Active'
    },
    {
      product_key: 'tiffin',
      name: 'Tiffin Service',
      tagline: 'Homemade, hygienic meal delivery in your neighborhood',
      icon: 'in/product/tiffin/favicon/tiffin-favicon.png',
      logo: 'in/product/tiffin/logo/tiffin-logo.png',
      url: 'https://www.tiffinservice.app',
      badge: 'Active'
    }
  ];

  /**
   * Product API Service
   * Responsible for fetching ecosystem products and logos dynamically from backend API.
   */
  const ProductService = {
    /**
     * Retrieve all SeaNeb ecosystem products.
     * Attempts /api/v1/products/ninedots first, falls back to /api/v1/products.
     * Resolves all relative image paths against DigitalOcean Spaces S3 bucket URL.
     * @returns {Promise<Array<object>>}
     */
    async getProducts() {
      const primaryEndpoint = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRODUCTS_NINEDOTS}`;
      const fallbackEndpoint = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRODUCTS}`;

      try {
        let data = null;
        try {
          data = await fetchWithTimeout(primaryEndpoint);
        } catch (errPrimary) {
          console.warn(`[SeaNeb API] ${primaryEndpoint} unavailable, trying ${fallbackEndpoint}:`, errPrimary.message);
          data = await fetchWithTimeout(fallbackEndpoint);
        }

        const rawList = Array.isArray(data) ? data : (data.products || data.data || []);
        if (!Array.isArray(rawList) || rawList.length === 0) {
          throw new Error('API returned empty or non-array product list');
        }

        return this.normalizeProducts(rawList);
      } catch (error) {
        console.warn(`[SeaNeb API] Could not fetch products from ${API_CONFIG.BASE_URL}:`, error.message);
        if (API_CONFIG.ENABLE_FALLBACK_DATA) {
          console.info('[SeaNeb API] Using standard SeaNeb ecosystem configuration dataset.');
          return this.normalizeProducts(DEFAULT_ECOSYSTEM_PRODUCTS);
        }
        throw error;
      }
    },

    /**
     * Normalize products from various backend API shapes into a consistent object model
     * with fully qualified S3 logo & icon URLs.
     * @param {Array<object>} rawList 
     * @returns {Array<object>}
     */
    normalizeProducts(rawList) {
      return (rawList || []).map(p => {
        const key = (p.product_key || p.id || '').toLowerCase();
        let webUrl = p.href || p.web_url || p.url || '';
        if (!webUrl || webUrl.includes('159.65.154.221')) {
          webUrl = CANONICAL_URLS[key] || webUrl || '#';
        }

        const iconPath = p.icon || p.favicon_url || '';
        const logoPath = p.logo || p.logo_url || '';
        const darkLogoPath = p.dark_logo || p.dark_logo_url || '';
        const darkIconPath = p.dark_favicon || p.dark_favicon_url || '';

        return {
          id: p.product_id || key || 'product',
          key: key,
          name: p.name || p.product_name || 'Product',
          tagline: p.description || p.tagline || '',
          url: webUrl,
          iconUrl: resolveMediaUrl(iconPath),
          logoUrl: resolveMediaUrl(logoPath),
          darkLogoUrl: resolveMediaUrl(darkLogoPath),
          darkIconUrl: resolveMediaUrl(darkIconPath),
          fallbackIcon: LOCAL_FALLBACKS[key] || API_CONFIG.FALLBACK_LOGO_URL,
          isActive: p.is_active !== false,
          isVisible: p.is_visible !== false
        };
      });
    },

    /**
     * Retrieve the 3 primary showcase products for the homepage (Seaneb App, Seaneb Jobs, Tiffin Service)
     * with their dynamic icons/logos fetched from the API and S3.
     * @returns {Promise<Array<object>>}
     */
    async getShowcaseProducts() {
      const allProducts = await this.getProducts();

      // Showcase products in canonical order
      const targetKeys = ['seaneb', 'jobs', 'tiffin'];
      const showcaseItems = [];

      targetKeys.forEach(key => {
        const found = allProducts.find(p => p.key === key) || allProducts.find(p => p.key.includes(key));
        if (found) {
          let friendlyName = found.name;
          if (key === 'seaneb') friendlyName = 'Seaneb App';
          if (key === 'jobs') friendlyName = 'Seaneb Jobs';
          if (key === 'tiffin') friendlyName = 'Tiffin Service';

          // For the 38x38 showcase icon box:
          // Prefer square iconUrl, if not available fall back to official local icon or logoUrl
          const showcaseIcon = found.iconUrl || found.fallbackIcon || found.logoUrl;

          showcaseItems.push({
            ...found,
            displayName: friendlyName,
            displayIcon: showcaseIcon
          });
        } else {
          const defaultItem = DEFAULT_ECOSYSTEM_PRODUCTS.find(d => d.product_key === key);
          if (defaultItem) {
            showcaseItems.push({
              key: key,
              name: defaultItem.name,
              displayName: defaultItem.name,
              url: defaultItem.url,
              displayIcon: resolveMediaUrl(defaultItem.icon || defaultItem.logo),
              fallbackIcon: LOCAL_FALLBACKS[key] || API_CONFIG.FALLBACK_LOGO_URL
            });
          }
        }
      });

      return showcaseItems;
    },

    /**
     * Retrieve official SeaNeb brand logos (Header brand logo & Hero pin icon)
     * @returns {Promise<{headerLogo: string, headerLogoFallback: string, heroBrandIcon: string, heroBrandIconFallback: string}>}
     */
    async getBrandLogos() {
      const pinIconUrl = 'https://www.seaneb.com/images/logo/apple-touch-icon.png';
      return {
        headerLogo: pinIconUrl,
        headerLogoFallback: 'assets/images/seaneb-icon.png',
        heroBrandIcon: pinIconUrl,
        heroBrandIconFallback: 'assets/images/seaneb-icon.png'
      };
    },

    /**
     * Resolve any media relative path against the S3 base URL
     * @param {string} path 
     * @returns {string}
     */
    resolveMediaUrl(path) {
      return resolveMediaUrl(path);
    },

    /**
     * Get fallback logo URL for failed or missing images
     * @returns {string}
     */
    getFallbackLogo() {
      return API_CONFIG.FALLBACK_LOGO_URL;
    }
  };

  /**
   * Search API Service
   */
  const SearchService = {
    /**
     * Execute search query against SeaNeb catalog
     * @param {string} query 
     * @param {string} location 
     * @returns {Promise<object>}
     */
    async search(query, location) {
      const params = new URLSearchParams({
        q: query || '',
        location: location || ''
      });

      const endpoint = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEARCH}?${params.toString()}`;

      try {
        if (!API_CONFIG.BASE_URL && !window.__SEANEB_FORCE_REAL_API__) {
          // Simulated local search response
          return {
            status: 'success',
            query,
            location,
            timestamp: new Date().toISOString(),
            message: `Searching for "${query}" in "${location}"`
          };
        }

        return await fetchWithTimeout(endpoint);
      } catch (err) {
        console.warn(`[SeaNeb API] Search request error:`, err.message);
        return {
          status: 'simulated',
          query,
          location,
          timestamp: new Date().toISOString(),
          message: `Local search triggered for "${query}" in "${location}"`
        };
      }
    }
  };

  /**
   * Location API Service
   */
  const LocationService = {
    /**
     * Default list of popular locations
     */
    popularLocations: [
      { id: 'anand', name: 'Anand', state: 'Gujarat', default: true },
      { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat' },
      { id: 'vadodara', name: 'Vadodara', state: 'Gujarat' },
      { id: 'surat', name: 'Surat', state: 'Gujarat' },
      { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra' },
      { id: 'pune', name: 'Pune', state: 'Maharashtra' },
      { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka' },
      { id: 'delhi-ncr', name: 'Delhi NCR', state: 'Delhi' }
    ],

    async getLocations() {
      return this.popularLocations;
    },

    /**
     * Use browser geolocation to detect current location
     * @returns {Promise<{name: string, coords: {lat: number, lng: number}}>}
     */
    detectCurrentLocation() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              name: 'Current Location',
              coords: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              }
            });
          },
          (error) => {
            reject(error);
          },
          { timeout: 8000, enableHighAccuracy: true }
        );
      });
    }
  };

  /**
   * Categories Data & Service (Order strictly matches reference design)
   */
  const CategoryService = {
    categories: [
      {
        id: 'restaurants',
        name: 'Restaurants',
        iconName: 'utensils',
        bg: '#FFF3EC',
        color: '#EA580C',
        query: 'restaurants'
      },
      {
        id: 'shopping',
        name: 'Shopping',
        iconName: 'shopping-bag',
        bg: '#FDF2F8',
        color: '#DB2777',
        query: 'shopping'
      },
      {
        id: 'doctors',
        name: 'Doctors',
        iconName: 'stethoscope',
        bg: '#ECFDF5',
        color: '#059669',
        query: 'doctors'
      },
      {
        id: 'salons',
        name: 'Salons',
        iconName: 'scissors',
        bg: '#F5F3FF',
        color: '#7C3AED',
        query: 'salons'
      },
      {
        id: 'home-services',
        name: 'Home Services',
        iconName: 'home-wrench',
        bg: '#FEFCE8',
        color: '#CA8A04',
        query: 'home services'
      },
      {
        id: 'jobs',
        name: 'Jobs',
        iconName: 'briefcase',
        bg: '#EFF6FF',
        color: '#2563EB',
        query: 'jobs'
      },
      {
        id: 'automotive',
        name: 'Automotive',
        iconName: 'car',
        bg: '#EEF2FF',
        color: '#4F46E5',
        query: 'automotive'
      },
      {
        id: 'hotels',
        name: 'Hotels',
        iconName: 'hotel',
        bg: '#F0FDFA',
        color: '#0D9488',
        query: 'hotels'
      },
      {
        id: 'more',
        name: 'More',
        iconName: 'grid-more',
        bg: '#F8FAFC',
        color: '#475569',
        query: 'all categories'
      }
    ],

    async getCategories() {
      return this.categories;
    }
  };

  // Public API Export
  return {
    CONFIG: API_CONFIG,
    ProductService,
    SearchService,
    LocationService,
    CategoryService
  };
});
