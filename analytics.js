// Analytics service for Trackly - Enhanced with ASIN tracking

const ANALYTICS_KEY = "trackly_analytics"
const INSTALL_DATE_KEY = "trackly_install_date"
const USER_ID_KEY = "trackly_user_id"

// Declare chrome variable
const chrome = window.chrome

// Generate a random user ID
function generateUserId() {
  return "user_" + Math.random().toString(36).substring(2, 15)
}

// Initialize analytics
async function initAnalytics() {
  const data = await chrome.storage.local.get([INSTALL_DATE_KEY, USER_ID_KEY])

  if (!data[INSTALL_DATE_KEY]) {
    // First time initialization
    const installDate = new Date().toISOString()
    const userId = generateUserId()

    await chrome.storage.local.set({
      [INSTALL_DATE_KEY]: installDate,
      [USER_ID_KEY]: userId,
    })

    // Track installation event
    trackEvent("extension", "install", {
      installDate,
      userId,
    })
  }
}

// Get analytics data
async function getAnalytics() {
  const data = await chrome.storage.local.get(ANALYTICS_KEY)
  return (
    data[ANALYTICS_KEY] || {
      events: [],
      metrics: {
        totalInstalls: 0,
        newUsersLast30Days: 0,
        priceChartViews: 0,
        priceChartEngagements: 0,
        aiInsightViews: 0,
        aiInsightEngagements: 0,
        productsWatchlisted: 0,
        uniqueProductsWatchlisted: new Set(),
        productPageViews: 0,
        searchPageViews: 0,
        asinExtractionSuccess: 0,
        asinExtractionFailure: 0,
        pageVisits: 0,
        uniqueAsinsFound: new Set(),
      },
    }
  )
}

// Save analytics data
async function saveAnalytics(analytics) {
  // Convert Set to Array for storage
  if (analytics.metrics.uniqueProductsWatchlisted instanceof Set) {
    analytics.metrics.uniqueProductsWatchlistedCount = analytics.metrics.uniqueProductsWatchlisted.size
    analytics.metrics.uniqueProductsWatchlisted = Array.from(analytics.metrics.uniqueProductsWatchlisted)
  }

  if (analytics.metrics.uniqueAsinsFound instanceof Set) {
    analytics.metrics.uniqueAsinsFoundCount = analytics.metrics.uniqueAsinsFound.size
    analytics.metrics.uniqueAsinsFound = Array.from(analytics.metrics.uniqueAsinsFound)
  }

  await chrome.storage.local.set({
    [ANALYTICS_KEY]: analytics,
  })
}

// Track an event
async function trackEvent(category, action, properties = {}) {
  const analytics = await getAnalytics()
  const timestamp = new Date().toISOString()
  const userData = await chrome.storage.local.get([USER_ID_KEY])
  const userId = userData[USER_ID_KEY] || generateUserId()

  // Add event to events array
  analytics.events.push({
    category,
    action,
    properties,
    timestamp,
    userId,
  })

  // Limit events array to last 1000 events
  if (analytics.events.length > 1000) {
    analytics.events = analytics.events.slice(-1000)
  }

  // Update metrics based on event
  updateMetrics(analytics, category, action, properties)

  // Save updated analytics
  await saveAnalytics(analytics)
}

// Update metrics based on event
function updateMetrics(analytics, category, action, properties) {
  const metrics = analytics.metrics

  // Track installation
  if (category === "extension" && action === "install") {
    metrics.totalInstalls++

    // Check if within last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    if (new Date(properties.installDate) > thirtyDaysAgo) {
      metrics.newUsersLast30Days++
    }
  }

  // Track page visits
  if (category === "page" && action === "visit") {
    metrics.pageVisits++

    // Track ASIN extraction success/failure
    if (properties.hasAsin) {
      metrics.asinExtractionSuccess++

      // Track unique ASINs found
      if (properties.asin && properties.asin !== "none") {
        // Convert to Set if it's an array
        if (Array.isArray(metrics.uniqueAsinsFound)) {
          metrics.uniqueAsinsFound = new Set(metrics.uniqueAsinsFound)
        }
        metrics.uniqueAsinsFound.add(properties.asin)
      }
    } else {
      metrics.asinExtractionFailure++
    }
  }

  // Track product page views
  if (category === "product" && action === "view") {
    metrics.productPageViews++
  }

  // Track search page views
  if (category === "search" && action === "view") {
    metrics.searchPageViews++

    // Track ASINs found in search results
    if (properties.asins && Array.isArray(properties.asins)) {
      // Convert to Set if it's an array
      if (Array.isArray(metrics.uniqueAsinsFound)) {
        metrics.uniqueAsinsFound = new Set(metrics.uniqueAsinsFound)
      }

      properties.asins.forEach((asin) => {
        metrics.uniqueAsinsFound.add(asin)
      })
    }
  }

  // Track price chart engagement
  if (category === "priceChart" && action === "view") {
    metrics.priceChartViews++
  }

  if (category === "priceChart" && action === "interact") {
    metrics.priceChartEngagements++
  }

  // Track AI insight engagement
  if (category === "aiInsight" && action === "view") {
    metrics.aiInsightViews++
  }

  if (category === "aiInsight" && action === "interact") {
    metrics.aiInsightEngagements++
  }

  // Track watchlist additions
  if (category === "watchlist" && action === "add") {
    metrics.productsWatchlisted++

    // Convert to Set if it's an array
    if (Array.isArray(metrics.uniqueProductsWatchlisted)) {
      metrics.uniqueProductsWatchlisted = new Set(metrics.uniqueProductsWatchlisted)
    }

    // Add to unique products set
    if (properties.asin) {
      metrics.uniqueProductsWatchlisted.add(properties.asin)
    }
  }
}

// Calculate engagement rates
function calculateEngagementRates(analytics) {
  const metrics = analytics.metrics

  // Price chart engagement rate
  const priceChartEngagementRate =
    metrics.priceChartViews > 0 ? (metrics.priceChartEngagements / metrics.priceChartViews) * 100 : 0

  // AI insight engagement rate
  const aiInsightEngagementRate =
    metrics.aiInsightViews > 0 ? (metrics.aiInsightEngagements / metrics.aiInsightViews) * 100 : 0

  // Product view to chart view rate
  const productToChartViewRate =
    metrics.productPageViews > 0 ? (metrics.priceChartViews / metrics.productPageViews) * 100 : 0

  // ASIN extraction success rate
  const asinExtractionRate = metrics.pageVisits > 0 ? (metrics.asinExtractionSuccess / metrics.pageVisits) * 100 : 0

  return {
    priceChartEngagementRate: priceChartEngagementRate.toFixed(2),
    aiInsightEngagementRate: aiInsightEngagementRate.toFixed(2),
    productToChartViewRate: productToChartViewRate.toFixed(2),
    asinExtractionRate: asinExtractionRate.toFixed(2),
  }
}

// Export functions globally
window.tracklyAnalytics = {
  initAnalytics,
  trackEvent,
  getAnalytics,
  calculateEngagementRates,
}

// Initialize analytics when the script loads
initAnalytics()
