// Background script for Trackly - Enhanced logging
console.log("Trackly: Background script loaded")


// Key management configuration
const SECRETS_ENDPOINT = "https://evpxv92u1l.execute-api.us-east-2.amazonaws.com/PROD/secrets"
const EXTENSION_API_KEY = "aa79fb2656c48210d7d9cfa3821ff6f4"
const SECRETS_CACHE_KEY = "trackly_secrets_cache"
const SECRETS_EXPIRY_KEY = "trackly_secrets_expiry"

// Cache for storing price history data
const priceCache = {}

// Key management functions
async function checkKeys() {
  const data = await chrome.storage.local.get(["supabaseUrl", "supabaseKey", "keepaKey"])
  return {
    hasSupabaseKeys: !!(data.supabaseUrl && data.supabaseKey),
    hasKeepaKey: !!data.keepaKey,
  }
}

async function saveKeys(keys) {
  await chrome.storage.local.set(keys)
  return true
}

async function getKeys() {
  return await chrome.storage.local.get(["supabaseUrl", "supabaseKey", "keepaKey"])
}

async function fetchSecrets() {
  console.log("Trackly: Fetching secrets from Lambda")

  // Check if we have cached secrets that haven't expired
  const cache = await chrome.storage.local.get([SECRETS_CACHE_KEY, SECRETS_EXPIRY_KEY])
  const now = Date.now()

  if (cache[SECRETS_CACHE_KEY] && cache[SECRETS_EXPIRY_KEY] && now < cache[SECRETS_EXPIRY_KEY]) {
    console.log("Trackly: Using cached secrets")
    return cache[SECRETS_CACHE_KEY]
  }

  try {
    // Get the extension ID
    const extensionId = chrome.runtime.id

    console.log("Trackly: Making request to Lambda with extension ID:", extensionId)

    // Fetch secrets from Lambda
    const response = await fetch(SECRETS_ENDPOINT, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": EXTENSION_API_KEY,
        "X-Extension-Id": extensionId,
      },
    })

    console.log("Trackly: Lambda response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Trackly: Lambda error response:", errorText)
      throw new Error(`Failed to fetch secrets: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log("Trackly: Secrets fetched successfully from Lambda")

    if (!result.success) {
      throw new Error(`API returned error: ${result.error || "Unknown error"}`)
    }

    // Cache the secrets
    await chrome.storage.local.set({
      [SECRETS_CACHE_KEY]: result.data,
      [SECRETS_EXPIRY_KEY]: result.expiresAt,
    })

    // Also save individual keys for backward compatibility
    await saveKeys({
      supabaseUrl: result.data.supabaseUrl,
      supabaseKey: result.data.supabaseKey,
      keepaKey: result.data.keepaApiKey,
    })

    console.log("Trackly: Secrets fetched and cached successfully")
    return result.data
  } catch (error) {
    console.error("Trackly: Error fetching secrets:", error)

    // Return any cached secrets even if expired
    if (cache[SECRETS_CACHE_KEY]) {
      console.log("Trackly: Using expired cached secrets")
      return cache[SECRETS_CACHE_KEY]
    }

    throw error
  }
}

async function initializeKeys() {
  console.log("Trackly: Initializing keys...")

  try {
    await fetchSecrets()
    console.log("Trackly: Keys initialized successfully")
    return true
  } catch (error) {
    console.error("Trackly: Failed to initialize keys:", error)

    // Check if we have any cached keys as fallback
    const keysExist = await checkKeys()
    if (keysExist.hasSupabaseKeys && keysExist.hasKeepaKey) {
      console.log("Trackly: Using existing cached keys")
      return true
    }

    return false
  }
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("Trackly: Extension installed", details.reason)

  // Initialize keys on install or update
  if (details.reason === "install" || details.reason === "update") {
    try {
      const success = await initializeKeys()
      if (success) {
        console.log("Trackly: Keys initialized successfully")
      } else {
        console.error("Trackly: Failed to initialize keys")
      }
    } catch (error) {
      console.error("Trackly: Failed to initialize keys:", error)
    }
  }
})

// Listen for extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.log("Trackly: Extension started")

  // Refresh keys on startup
  try {
    await fetchSecrets()
    console.log("Trackly: Keys refreshed successfully")
  } catch (error) {
    console.error("Trackly: Failed to refresh keys:", error)
  }
})

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Trackly: Background received message:", request.type)

  if (request.type === "PING") {
    console.log("Trackly: Responding to PING")
    sendResponse({ success: true, message: "Background script working" })
    return true
  }

  if (request.type === "GET_PRICE_HISTORY") {
    console.log("Trackly: Getting price history for ASIN:", request.asin)

    // Use a Promise to handle the async operation
    fetchPriceHistory(request.asin)
      .then((data) => {
        console.log("Trackly: Price history fetched successfully:", data)
        // Cache the data
        priceCache[request.asin] = {
          data: data,
          timestamp: Date.now(),
        }
        sendResponse({ success: true, data: data })
      })
      .catch((error) => {
        console.error("Trackly: Error fetching price history:", error)
        sendResponse({ success: false, error: error.message })
      })

    return true // Required for async response
  }

  if (request.type === "FETCH_SECRETS") {
    console.log("Trackly: Fetching secrets")
    fetchSecrets()
      .then((secrets) => {
        console.log("Trackly: Secrets fetched successfully")
        sendResponse({ success: true, data: secrets })
      })
      .catch((error) => {
        console.error("Trackly: Error fetching secrets:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (request.type === "ADD_TO_WATCHLIST") {
    console.log("Trackly: Adding to watchlist:", request.product.asin)
    addToWatchlist(request.product)
      .then(() => {
        console.log("Trackly: Added to watchlist successfully")
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error("Trackly: Error adding to watchlist:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (request.type === "REMOVE_FROM_WATCHLIST") {
    console.log("Trackly: Removing from watchlist:", request.asin)
    removeFromWatchlist(request.asin)
      .then(() => {
        console.log("Trackly: Removed from watchlist successfully")
        sendResponse({ success: true })
      })
      .catch((error) => {
        console.error("Trackly: Error removing from watchlist:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }

  if (request.type === "GET_WATCHLIST") {
    console.log("Trackly: Getting watchlist")
    getWatchlist()
      .then((watchlist) => {
        console.log("Trackly: Watchlist retrieved:", watchlist.length, "items")
        sendResponse({ success: true, watchlist })
      })
      .catch((error) => {
        console.error("Trackly: Error getting watchlist:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true
  }
})

// Fetch price history from Keepa API
async function fetchPriceHistory(asin) {
  console.log("Trackly: fetchPriceHistory called for ASIN:", asin)

  // Check cache first (cache valid for 6 hours)
  if (priceCache[asin] && Date.now() - priceCache[asin].timestamp < 6 * 60 * 60 * 1000) {
    console.log("Trackly: Returning cached data for ASIN:", asin)
    return priceCache[asin].data
  }

  // Get API key from storage
  const keys = await getKeys()
  let apiKey = keys.keepaKey

  if (!apiKey) {
    console.log("Trackly: No Keepa API key found, trying to fetch from Lambda")
    try {
      const secrets = await fetchSecrets()
      apiKey = secrets.keepaApiKey

      if (!apiKey) {
        throw new Error("No Keepa API key available")
      }
    } catch (error) {
      console.error("Trackly: Failed to get Keepa API key:", error)
      return getMockPriceData(asin)
    }
  }

  const url = `https://api.keepa.com/product?key=${apiKey}&domain=1&asin=${asin}&stats=1`

  try {
    console.log("Trackly: Fetching from Keepa API")
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    const data = await response.json()
    return processKeepaData(data, asin)
  } catch (error) {
    console.error("Trackly: Keepa API error:", error)
    // Return mock data for testing
    return getMockPriceData(asin)
  }
}

// Declare processKeepaData function
function processKeepaData(data, asin) {
  // Process Keepa API data here
  // For now, return mock data as a placeholder
  return getMockPriceData(asin)
}

// Mock data for testing when Keepa API is not available
async function getMockPriceData(asin) {
  console.log("Trackly: Generating mock data for ASIN:", asin)

  // Generate mock price history for the last 12 months
  const now = Date.now()
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000
  const timePoints = []
  const prices = []

  // Generate 50 data points over the year
  for (let i = 0; i < 50; i++) {
    const time = oneYearAgo + (i * (now - oneYearAgo)) / 49
    const basePrice = 25 + Math.random() * 50 // Random price between $25-$75
    const variation = Math.sin(i * 0.3) * 5 // Add some variation
    const price = Math.max(15, basePrice + variation) // Minimum $15

    timePoints.push(time)
    prices.push(Number(price.toFixed(2)))
  }

  const currentPrice = prices[prices.length - 1]
  const lowestPrice = Math.min(...prices)
  const highestPrice = Math.max(...prices)
  const lowestPriceLast12Months = lowestPrice

  // Determine deal signal
  let dealSignal
  if (currentPrice <= lowestPriceLast12Months * 1.05) {
    dealSignal = "green"
  } else if (currentPrice >= lowestPriceLast12Months * 1.2) {
    dealSignal = "red"
  } else {
    dealSignal = "yellow"
  }

  let recommendation
  if (dealSignal === "green") {
    recommendation = "Buy Now: This is one of the lowest prices we've seen in the past 12 months."
  } else if (dealSignal === "yellow") {
    recommendation = "Consider: The price is reasonable but has been lower in the past."
  } else {
    recommendation = "Wait: We've seen significantly better prices in the past 12 months."
  }

  const mockData = {
    asin,
    currentPrice,
    lowestPrice,
    highestPrice,
    lowestPriceLast12Months,
    dealSignal,
    recommendation,
    priceHistory: {
      timePoints,
      prices,
    },
  }

  console.log("Trackly: Mock data generated:", mockData)
  return mockData
}

// Watchlist functions
async function addToWatchlist(product) {
  const watchlist = await getWatchlist()

  // Check if product is already in watchlist
  const existingIndex = watchlist.findIndex((item) => item.asin === product.asin)
  if (existingIndex >= 0) {
    watchlist[existingIndex] = product // Update existing entry
  } else {
    watchlist.push(product) // Add new entry
  }

  return chrome.storage.local.set({ watchlist })
}

async function removeFromWatchlist(asin) {
  const watchlist = await getWatchlist()
  const updatedWatchlist = watchlist.filter((item) => item.asin !== asin)
  return chrome.storage.local.set({ watchlist: updatedWatchlist })
}

async function getWatchlist() {
  const data = await chrome.storage.local.get("watchlist")
  return data.watchlist || []
}

console.log("Trackly: Background script ready")
