// Background script for Trackly - Enhanced logging
console.log("Trackly: Background script loaded")

// Cache for storing price history data
const priceCache = {}

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Trackly: Extension installed", details.reason)
})

// Listen for extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log("Trackly: Extension started")
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
    getMockPriceData(request.asin)
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
