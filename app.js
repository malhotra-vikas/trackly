
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

// ≤ 5% above lowest	- Green
// Between 5% above lowest and 80% of highest	- Yellow
// Close to or above highest	
function computeDealSignal(currentPrice, lowestPrice, highestPrice) {
  const nearLowestThreshold = lowestPrice * 1.05
  const nearHighestThreshold = highestPrice * 0.8

  if (currentPrice <= nearLowestThreshold) {
    return "green"
  } else if (currentPrice <= nearHighestThreshold) {
    return "yellow"
  } else {
    return "red"
  }
}


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

  productData.dealSignal = computeDealSignal(
    productData.price,
    lowest,
    highest
  )

  const labelMap = {
    green: "🟢 ",
    yellow: "🟡 ",
    red: "🔴 ",
  }

  const colorMap = {
    green: '#A8C3A0',      // Muted Sage
    yellow: '#E7D8A1',     // Warm Sandstone
    red: '#D9A6A1'         // Rosewood Clay
  }

  // Apply dynamic border-left color based on deal signal
  const borderColors = {
    green: "#10B981",   // emerald-500
    yellow: "#F59E0B",  // amber-500
    red: "#EF4444",     // red-500
  }

  // Set recommendation
  const recommendationTextElement = document.getElementById("recommendation-text")
  const recommendationContainer = document.getElementById("recommendation")

  recommendationTextElement.textContent =
    `${labelMap[productData.dealSignal]} ${productData.buyRecommendation}`

  recommendationTextElement.style.borderLeftColor = colorMap[productData.dealSignal] || '#D9CFC5'

  const signalColor = borderColors[productData.dealSignal] || "#4F46E5" // fallback to indigo
  //recommendationContainer.style.borderLeftColor = signalColor


  // Render price chart
  renderPriceChart()

  // Update watchlist button
  updateWatchlistButton()

  // Add event listeners
  setupEventListeners()
}

function renderPriceChart() {
  console.log("Trackly: Rendering price chart");

  const canvas = document.getElementById("price-chart");
  if (!canvas) {
    console.error("Trackly: Canvas element not found.");
    return;
  }

  // Explicitly set chart height for layout consistency
  canvas.height = 200;

  // If Chart.js is already available, create chart immediately
  if (typeof Chart !== "undefined") {
    createChart();
    return;
  }

  // Dynamically load Chart.js only if it's not already available
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("chart.umd.js"); // Adjusted to reflect your actual file
  script.onload = () => {
    console.log("Trackly: Chart.js loaded");
    createChart();
  };
  script.onerror = () => {
    console.error("Trackly: Failed to load Chart.js");
    canvas.parentElement.innerHTML = "<p>Chart unavailable</p>";
  };
  document.head.appendChild(script);
}

function createChart() {
  const canvas = document.getElementById("price-chart");
  const ctx = canvas.getContext("2d");

  const history = productData?.priceHistory || [];

  const labels = history.map((entry) => {
    const date = new Date(entry.date);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  });

  const prices = history.map((entry) => entry.marketplacePrice ?? entry.amazonPrice);

  if (!prices.length) {
    canvas.parentElement.innerHTML = "<p>No price data available</p>";
    return;
  }

  // Destroy existing chart instance if needed
  if (canvas._chartInstance) {
    canvas._chartInstance.destroy();
  }

  const chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Price",
          data: prices,
          borderColor: "#A8C3A0", // Muted Sage (Brand)
          backgroundColor: "rgba(168, 195, 160, 0.2)", // Soft fill
          borderWidth: 2,
          pointRadius: 2,
          pointBackgroundColor: "#A8C3A0", // Optional: Muted Sage for consistency
          pointHoverRadius: 5,
          tension: 0.2,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
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
          grid: { display: false },
          ticks: {
            maxTicksLimit: 6,
            color: "#5E5E5E", // Charcoal Gray
            font: { family: "Inter, sans-serif" },
          },
        },
        y: {
          ticks: {
            color: "#1C1C1E", // Soft Black
            callback: (value) => `$${value}`,
            font: { family: "Inter, sans-serif" },
          },
        },
      },
    },
  });

  // Save chart instance for future cleanup
  canvas._chartInstance = chartInstance;

  console.log("Trackly: Chart created successfully");
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
