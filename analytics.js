// Analytics service for Trackly
// Use the global tracklySupabase object instead of importing

const ANALYTICS_KEY = "trackly_analytics"
const INSTALL_DATE_KEY = "trackly_install_date"
const USER_ID_KEY = "trackly_user_id"

// Declare chrome variable
const chrome = window.chrome

// Initialize Supabase auth
function initAnalyticsWithSupabase() {
  if (window.tracklySupabase) {
    window.tracklySupabase.initAuth().catch((error) => {
      console.error("Error initializing Supabase auth:", error)
    })
  } else {
    console.error("Supabase client not available")
  }
}

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

    // Sync with Supabase
    try {
      if (window.tracklySupabase) {
        await window.tracklySupabase.syncUser(userId, installDate)
      }
    } catch (error) {
      console.error("Error syncing user with Supabase:", error)
    }
  } else {
    // Existing user, sync with Supabase
    try {
      if (window.tracklySupabase) {
        const userId = data[USER_ID_KEY]
        const installDate = data[INSTALL_DATE_KEY]
        await window.tracklySupabase.syncUser(userId, installDate)
      }
    } catch (error) {
      console.error("Error syncing existing user with Supabase:", error)
    }
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

  // Send to Supabase
  try {
    if (window.tracklySupabase) {
      await window.tracklySupabase.trackEventInSupabase(userId, category, action, properties)
    }
  } catch (error) {
    console.error("Error tracking event in Supabase:", error)
  }
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

  // Track product page views
  if (category === "product" && action === "view") {
    metrics.productPageViews++
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

  return {
    priceChartEngagementRate: priceChartEngagementRate.toFixed(2),
    aiInsightEngagementRate: aiInsightEngagementRate.toFixed(2),
    productToChartViewRate: productToChartViewRate.toFixed(2),
  }
}

// Initialize when the script loads
setTimeout(initAnalyticsWithSupabase, 1000) // Give time for Supabase to load

// Export functions as global variables
window.tracklyAnalytics = {
  initAnalytics,
  trackEvent,
  getAnalytics,
  calculateEngagementRates,
}
