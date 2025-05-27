// Background script for Trackly

// Declare chrome variable
const chrome = window.chrome

// Cache for storing price history data
const priceCache = {}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_PRICE_HISTORY") {
    fetchPriceHistory(request.asin)
      .then((data) => {
        // Cache the data
        priceCache[request.asin] = {
          data: data,
          timestamp: Date.now(),
        }
        sendResponse({ success: true, data: data })
      })
      .catch((error) => {
        console.error("Error fetching price history:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true // Required for async response
  }

  if (request.type === "ADD_TO_WATCHLIST") {
    addToWatchlist(request.product)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  if (request.type === "REMOVE_FROM_WATCHLIST") {
    removeFromWatchlist(request.asin)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  if (request.type === "GET_WATCHLIST") {
    getWatchlist()
      .then((watchlist) => sendResponse({ success: true, watchlist }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }
})

// Fetch price history from Keepa API
async function fetchPriceHistory(asin) {
  // Check cache first (cache valid for 6 hours)
  if (priceCache[asin] && Date.now() - priceCache[asin].timestamp < 6 * 60 * 60 * 1000) {
    return priceCache[asin].data
  }

  // Replace with your actual Keepa API key
  const apiKey = "YOUR_KEEPA_API_KEY"
  const url = `https://api.keepa.com/product?key=${apiKey}&domain=1&asin=${asin}&stats=1`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    const data = await response.json()
    return processKeepaData(data, asin)
  } catch (error) {
    console.error("Keepa API error:", error)
    throw error
  }
}

// Process raw Keepa data into a more usable format
function processKeepaData(keepaData, asin) {
  if (!keepaData.products || keepaData.products.length === 0) {
    throw new Error("No product data found")
  }

  const product = keepaData.products[0]
  const priceHistory = product.csv
  const stats = product.stats

  // Extract relevant price data (Amazon price history)
  const amazonPrices = priceHistory[0] // Index 0 is typically Amazon price

  // Convert Keepa time format to JavaScript timestamps
  const timePoints = []
  const prices = []

  for (let i = 0; i < amazonPrices.length; i += 2) {
    const keepaTime = amazonPrices[i]
    const price = amazonPrices[i + 1] / 100 // Keepa prices are in cents

    // Convert Keepa time to JS timestamp (Keepa time is minutes since 2011-01-01)
    const jsTime = new Date(2011, 0, 1).getTime() + keepaTime * 60000

    timePoints.push(jsTime)
    prices.push(price)
  }

  // Calculate price insights
  const currentPrice = prices[prices.length - 1]
  const lowestPrice = Math.min(...prices.filter((p) => p > 0))
  const highestPrice = Math.max(...prices)

  // Get prices from last 12 months only
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
  const last12MonthsPrices = prices.filter((_, i) => timePoints[i] >= oneYearAgo && prices[i] > 0)
  const lowestPriceLast12Months = last12MonthsPrices.length > 0 ? Math.min(...last12MonthsPrices) : null

  // Determine deal signal
  let dealSignal
  if (currentPrice <= lowestPriceLast12Months * 1.05) {
    // Within 5% of lowest price
    dealSignal = "green"
  } else if (currentPrice >= lowestPriceLast12Months * 1.2) {
    // 20% or more above lowest price
    dealSignal = "red"
  } else {
    dealSignal = "yellow"
  }

  // Generate AI recommendation
  let recommendation
  if (dealSignal === "green") {
    recommendation = "Buy Now: This is one of the lowest prices we've seen in the past 12 months."
  } else if (dealSignal === "yellow") {
    recommendation = "Consider: The price is reasonable but has been lower in the past."
  } else {
    recommendation = "Wait: We've seen significantly better prices in the past 12 months."
  }

  return {
    asin,
    title: product.title,
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
}

// Watchlist functions
async function addToWatchlist(product) {
  const watchlist = await getWatchlist()
  const userData = await chrome.storage.local.get(["trackly_user_id"])
  const userId = userData.trackly_user_id

  // Check if product is already in watchlist
  const existingIndex = watchlist.findIndex((item) => item.asin === product.asin)
  if (existingIndex >= 0) {
    watchlist[existingIndex] = product // Update existing entry
  } else {
    watchlist.push(product) // Add new entry
  }

  // Sync with Supabase if available
  try {
    if (window.tracklySupabase) {
      await window.tracklySupabase.syncWatchlistItem(userId, product)
    }
  } catch (error) {
    console.error("Error syncing watchlist item with Supabase:", error)
  }

  return chrome.storage.local.set({ watchlist })
}

async function removeFromWatchlist(asin) {
  const watchlist = await getWatchlist()
  const updatedWatchlist = watchlist.filter((item) => item.asin !== asin)
  const userData = await chrome.storage.local.get(["trackly_user_id"])
  const userId = userData.trackly_user_id

  // Sync with Supabase if available
  try {
    if (window.tracklySupabase) {
      await window.tracklySupabase.removeWatchlistItemFromSupabase(userId, asin)
    }
  } catch (error) {
    console.error("Error removing watchlist item from Supabase:", error)
  }

  return chrome.storage.local.set({ watchlist: updatedWatchlist })
}

async function getWatchlist() {
  const data = await chrome.storage.local.get("watchlist")
  return data.watchlist || []
}

// Check watchlist items periodically for price drops
async function checkWatchlistPrices() {
  const watchlist = await getWatchlist()

  for (const item of watchlist) {
    try {
      const latestData = await fetchPriceHistory(item.asin)

      // Check if price dropped
      if (latestData.currentPrice < item.currentPrice) {
        // Send notification
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: "Price Drop Alert!",
          message: `${item.title} price dropped from $${item.currentPrice} to $${latestData.currentPrice}!`,
        })

        // Update watchlist item with new price
        await addToWatchlist({
          ...item,
          currentPrice: latestData.currentPrice,
          dealSignal: latestData.dealSignal,
        })
      }
    } catch (error) {
      console.error(`Error checking price for ${item.asin}:`, error)
    }
  }
}

// Check watchlist prices every 6 hours
setInterval(checkWatchlistPrices, 6 * 60 * 60 * 1000)

// Initialize analytics when extension loads
chrome.runtime.onInstalled.addListener(() => {
  console.log("Trackly extension installed")
  // We'll initialize analytics from content script since it has access to the Supabase client
})
