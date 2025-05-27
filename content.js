import { Chart } from "@/components/ui/chart"
// App script for Trackly

let productData = null
let priceChart = null
let isInWatchlist = false
const chrome = window.chrome // Declare the chrome variable

// Listen for messages from the content script
window.addEventListener("message", async (event) => {
  // Make sure the message is from our content script
  if (event.data.type !== "PRODUCT_DETAILS") return

  const { productDetails } = event.data

  // Show loading state
  document.getElementById("loading").style.display = "flex"
  document.getElementById("content").style.display = "none"
  document.getElementById("error").style.display = "none"

  try {
    // Get price history from background script
    const response = await chrome.runtime.sendMessage({
      type: "GET_PRICE_HISTORY",
      asin: productDetails.asin,
    })

    if (response.success) {
      productData = {
        ...productDetails,
        ...response.data,
      }

      // Check if product is in watchlist
      const watchlistResponse = await chrome.runtime.sendMessage({ type: "GET_WATCHLIST" })
      if (watchlistResponse.success) {
        isInWatchlist = watchlistResponse.watchlist.some((item) => item.asin === productData.asin)
      }

      renderProductData()
    } else {
      showError()
    }
  } catch (error) {
    console.error("Error fetching price history:", error)
    showError()
  }
})

function renderProductData() {
  if (!productData) return

  // Hide loading, show content
  document.getElementById("loading").style.display = "none"
  document.getElementById("content").style.display = "block"

  // Set product title
  document.getElementById("product-title").textContent = productData.title

  // Set current price
  document.getElementById("current-price").textContent = `$${productData.currentPrice.toFixed(2)}`

  // Set deal signal
  const dealSignalElement = document.getElementById("deal-signal")
  dealSignalElement.className = `deal-signal signal-${productData.dealSignal}`

  // Set price stats
  document.getElementById("lowest-price").textContent = `$${productData.lowestPriceLast12Months.toFixed(2)}`
  document.getElementById("highest-price").textContent = `$${productData.highestPrice.toFixed(2)}`

  // Set recommendation
  const recommendationElement = document.getElementById("recommendation")
  recommendationElement.textContent = productData.recommendation

  // Add color based on deal signal
  if (productData.dealSignal === "green") {
    recommendationElement.style.borderLeftColor = "#10B981"
  } else if (productData.dealSignal === "yellow") {
    recommendationElement.style.borderLeftColor = "#F59E0B"
  } else {
    recommendationElement.style.borderLeftColor = "#EF4444"
  }

  // Track price chart view
  if (window.tracklyAnalytics) {
    window.tracklyAnalytics.trackEvent("priceChart", "view", {
      asin: productData.asin,
    })

    // Track AI insight view
    window.tracklyAnalytics.trackEvent("aiInsight", "view", {
      asin: productData.asin,
      recommendation: productData.recommendation,
      dealSignal: productData.dealSignal,
    })
  }

  // Render price chart
  renderPriceChart()

  // Update watchlist button
  updateWatchlistButton()

  // Add event listeners
  setupEventListeners()
}

function renderPriceChart() {
  const ctx = document.getElementById("price-chart").getContext("2d")

  // Convert timestamps to dates
  const labels = productData.priceHistory.timePoints.map((timestamp) => {
    const date = new Date(timestamp)
    return `${date.getMonth() + 1}/${date.getDate()}`
  })

  // Destroy existing chart if it exists
  if (priceChart) {
    priceChart.destroy()
  }

  // Create new chart
  priceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Price",
          data: productData.priceHistory.prices,
          borderColor: "#4F46E5",
          backgroundColor: "rgba(79, 70, 229, 0.1)",
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            label: (context) => `$${context.raw.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            maxTicksLimit: 6,
          },
        },
        y: {
          beginAtZero: false,
          ticks: {
            callback: (value) => "$" + value,
          },
        },
      },
    },
  })

  // Add event listener for chart interactions
  priceChart.canvas.addEventListener("click", () => {
    if (window.tracklyAnalytics) {
      window.tracklyAnalytics.trackEvent("priceChart", "interact", {
        asin: productData.asin,
      })
    }
  })
}

function updateWatchlistButton() {
  const watchlistButton = document.getElementById("watchlist-button")

  if (isInWatchlist) {
    watchlistButton.textContent = "Remove from Watchlist"
    watchlistButton.classList.add("in-watchlist")
  } else {
    watchlistButton.textContent = "Add to Watchlist"
    watchlistButton.classList.remove("in-watchlist")
  }
}

function setupEventListeners() {
  // Close button
  document.getElementById("close-button").addEventListener("click", () => {
    // Send message to content script to hide overlay
    window.parent.postMessage({ type: "CLOSE_OVERLAY" }, "*")
  })

  // Watchlist button
  document.getElementById("watchlist-button").addEventListener("click", async () => {
    try {
      if (isInWatchlist) {
        // Remove from watchlist
        await chrome.runtime.sendMessage({
          type: "REMOVE_FROM_WATCHLIST",
          asin: productData.asin,
        })
        isInWatchlist = false
      } else {
        // Add to watchlist
        await chrome.runtime.sendMessage({
          type: "ADD_TO_WATCHLIST",
          product: {
            asin: productData.asin,
            title: productData.title,
            currentPrice: productData.currentPrice,
            imageUrl: productData.imageUrl,
            dealSignal: productData.dealSignal,
            url: productData.url,
          },
        })
        isInWatchlist = true

        // For adding to watchlist
        if (window.tracklyAnalytics) {
          window.tracklyAnalytics.trackEvent("watchlist", "add", {
            asin: productData.asin,
            price: productData.currentPrice,
          })
        }
      }

      updateWatchlistButton()
    } catch (error) {
      console.error("Error updating watchlist:", error)
    }
  })

  // Share button
  document.getElementById("share-button").addEventListener("click", () => {
    const text = `Check out this deal on ${productData.title}! Current price: $${productData.currentPrice.toFixed(2)}`
    const url = productData.url

    if (navigator.share) {
      navigator.share({
        title: "Trackly Price Alert",
        text: text,
        url: url,
      })
    } else {
      // Fallback to clipboard
      const shareText = `${text} ${url}`
      navigator.clipboard
        .writeText(shareText)
        .then(() => {
          alert("Link copied to clipboard!")
        })
        .catch((err) => {
          console.error("Failed to copy: ", err)
        })
    }
  })

  // Recommendation click
  document.getElementById("recommendation").addEventListener("click", () => {
    if (window.tracklyAnalytics) {
      window.tracklyAnalytics.trackEvent("aiInsight", "interact", {
        asin: productData.asin,
        recommendation: productData.recommendation,
      })
    }
  })

  // Retry button
  document.getElementById("retry-button").addEventListener("click", async () => {
    // Show loading state
    document.getElementById("loading").style.display = "flex"
    document.getElementById("error").style.display = "none"

    try {
      // Get price history from background script
      const response = await chrome.runtime.sendMessage({
        type: "GET_PRICE_HISTORY",
        asin: productData.asin,
        forceRefresh: true,
      })

      if (response.success) {
        productData = {
          ...productData,
          ...response.data,
        }
        renderProductData()
      } else {
        showError()
      }
    } catch (error) {
      console.error("Error fetching price history:", error)
      showError()
    }
  })
}

function showError() {
  document.getElementById("loading").style.display = "none"
  document.getElementById("content").style.display = "none"
  document.getElementById("error").style.display = "flex"
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Load Chart.js
  const script = document.createElement("script")
  script.src = "https://cdn.jsdelivr.net/npm/chart.js"
  script.onload = () => {
    console.log("Chart.js loaded")
  }
  document.head.appendChild(script)

  // Adjust iframe size based on content
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const height = entry.contentRect.height
      window.parent.postMessage(
        {
          type: "RESIZE_IFRAME",
          data: {
            width: 350,
            height: Math.min(450, height),
          },
        },
        "*",
      )
    }
  })

  resizeObserver.observe(document.body)
})
