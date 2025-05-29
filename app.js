
// App script for Trackly
console.log("Trackly: App script loaded")

let productData = null
let isInWatchlist = false

// Listen for messages from the content script
window.addEventListener("message", async (event) => {
  console.log("Trackly: App received message:", event.data)

  // Make sure the message is from our content script
  if (event.data.type !== "PRODUCT_DETAILS") return

  const { productDetails } = event.data
  console.log("Trackly: Product details received:", productDetails)

  // Show loading state
  document.getElementById("loading").style.display = "flex"
  document.getElementById("content").style.display = "none"
  document.getElementById("error").style.display = "none"

  try {
    // Test if chrome APIs are available
    if (!chrome || !chrome.runtime) {
      console.error("Trackly: Chrome APIs not available")
      showError("Chrome APIs not available")
      return
    }

    console.log("Trackly: Requesting price history for ASIN:", productDetails.asin)

    // Get price history from background script
    chrome.runtime.sendMessage(
      {
        type: "GET_PRICE_HISTORY",
        asin: productDetails.asin,
      },
      (response) => {
        console.log("Trackly: Price history response:", response)

        if (chrome.runtime.lastError) {
          console.error("Trackly: Runtime error:", chrome.runtime.lastError)
          showError(`Runtime error: ${chrome.runtime.lastError.message}`)
          return
        }

        if (response && response.success) {
          console.log("Trackly: Price data received successfully")
          productData = {
            ...productDetails,
            ...response.data,
          }

          // Check if product is in watchlist
          chrome.runtime.sendMessage({ type: "GET_WATCHLIST" }, (watchlistResponse) => {
            if (watchlistResponse && watchlistResponse.success) {
              isInWatchlist = watchlistResponse.watchlist.some((item) => item.asin === productData.asin)
            }
            renderProductData()
          })
        } else {
          console.error("Trackly: Failed to get price history:", response)
          showError(`Failed to get price history: ${response ? response.error : "No response"}`)
        }
      },
    )
  } catch (error) {
    console.error("Trackly: Error in message handler:", error)
    showError(`Error: ${error.message}`)
  }
})

function renderProductData() {
  if (!productData) {
    console.error("Trackly: No product data to render")
    showError("No product data available")
    return
  }

  console.log("Trackly: Rendering product data:", productData.asin)

  const history = productData.priceHistory
  console.log("Trackly: Price History:", history)

  const prices = history
    .map(entry => entry.marketplacePrice ?? entry.amazonPrice)
    .filter(price => typeof price === "number")
  console.log("Trackly: Price History Map: ", prices)

  if (prices.length === 0) return;

  const lowest = Math.min(...prices).toFixed(2);
  const highest = Math.max(...prices).toFixed(2);

  // Hide loading, show content
  document.getElementById("loading").style.display = "none"
  document.getElementById("content").style.display = "block"

  // Set product title
  document.getElementById("product-title").textContent = productData.title

  // Set current price
  document.getElementById("current-price").textContent = `$${productData.price.toFixed(2)}`

  // Set deal signal
  const dealSignalElement = document.getElementById("deal-signal")
  dealSignalElement.className = `deal-signal signal-${productData.dealSignal}`

  // Set price stats
  document.getElementById("lowest-price").textContent = `$${lowest}`;
  document.getElementById("highest-price").textContent = `$${highest}`;

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

  // Render price chart
  renderPriceChart()

  // Update watchlist button
  updateWatchlistButton()

  // Add event listeners
  setupEventListeners()
}

function renderPriceChart() {
  console.log("Trackly: Rendering price chart")

  // Load Chart.js if not already loaded
  if (typeof Chart === "undefined") {
    console.log("Trackly: Loading Chart.js")
    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/chart.js"
    script.onload = () => {
      console.log("Trackly: Chart.js loaded, rendering chart")
      createChart()
    }
    script.onerror = () => {
      console.error("Trackly: Failed to load Chart.js")
      document.getElementById("price-chart").parentElement.innerHTML = "<p>Chart unavailable</p>"
    }
    document.head.appendChild(script)
  } else {
    createChart()
  }
}

function createChart() {
  const canvas = document.getElementById("price-chart")
  if (!canvas) {
    console.error("Trackly: Chart canvas not found")
    return
  }

  const ctx = canvas.getContext("2d")

  const labels = productData.priceHistory.map((entry) => {
    const date = new Date(entry.date)
    return `${date.getMonth() + 1}/${date.getDate()}`
  })

  const prices = productData.priceHistory.map((entry) =>
    entry.marketplacePrice ?? entry.amazonPrice
  )

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Price",
          data: prices,
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

  console.log("Trackly: Chart created successfully")
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
    console.log("Trackly: Close button clicked")
    // Send message to content script to hide overlay
    window.parent.postMessage({ type: "CLOSE_OVERLAY" }, "*")
  })

  // Watchlist button
  document.getElementById("watchlist-button").addEventListener("click", async () => {
    console.log("Trackly: Watchlist button clicked")

    try {
      if (isInWatchlist) {
        // Remove from watchlist
        chrome.runtime.sendMessage(
          {
            type: "REMOVE_FROM_WATCHLIST",
            asin: productData.asin,
          },
          (response) => {
            if (response && response.success) {
              isInWatchlist = false
              updateWatchlistButton()
            }
          },
        )
      } else {
        // Add to watchlist
        chrome.runtime.sendMessage(
          {
            type: "ADD_TO_WATCHLIST",
            product: {
              asin: productData.asin,
              title: productData.title,
              currentPrice: productData.currentPrice,
              imageUrl: productData.imageUrl,
              dealSignal: productData.dealSignal,
              url: productData.url,
            },
          },
          (response) => {
            if (response && response.success) {
              isInWatchlist = true
              updateWatchlistButton()
            }
          },
        )
      }
    } catch (error) {
      console.error("Error updating watchlist:", error)
    }
  })

  // Share button
  document.getElementById("share-button").addEventListener("click", () => {
    console.log("Trackly: Share button clicked")
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
}

function showError(message) {
  console.error("Trackly: Showing error:", message)
  document.getElementById("loading").style.display = "none"
  document.getElementById("content").style.display = "none"
  document.getElementById("error").style.display = "flex"

  // Update error message
  const errorContainer = document.getElementById("error")
  const errorMessage = errorContainer.querySelector("p")
  if (errorMessage) {
    errorMessage.textContent = message || "Sorry, we couldn't retrieve price data for this product."
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  console.log("Trackly: App DOM loaded")

  // Add close button handler
  document.getElementById("close-button").addEventListener("click", () => {
    console.log("Trackly: Close button clicked")
    window.parent.postMessage({ type: "CLOSE_OVERLAY" }, "*")
  })
})

console.log("Trackly: App script ready")
