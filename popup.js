document.addEventListener("DOMContentLoaded", async () => {
  // Load watchlist
  const watchlistContainer = document.getElementById("watchlist-container")

  try {
    const response = await window.chrome.runtime.sendMessage({ type: "GET_WATCHLIST" })

    if (response.success) {
      renderWatchlist(response.watchlist)
    } else {
      watchlistContainer.innerHTML = `<p class="error">Error loading watchlist: ${response.error}</p>`
    }
  } catch (error) {
    watchlistContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`
  }

  // Handle settings
  const notificationToggle = document.getElementById("notification-toggle")

  // Load saved settings
  window.chrome.storage.local.get("settings", (data) => {
    if (data.settings) {
      notificationToggle.checked = data.settings.notifications
    }
  })

  // Save settings when changed
  notificationToggle.addEventListener("change", () => {
    window.chrome.storage.local.set({
      settings: {
        notifications: notificationToggle.checked,
      },
    })
  })

  // Add analytics button handler
  document.getElementById("view-analytics").addEventListener("click", () => {
    window.chrome.tabs.create({ url: window.chrome.runtime.getURL("analytics.html") })
  })
})

function renderWatchlist(watchlist) {
  const watchlistContainer = document.getElementById("watchlist-container")

  if (!watchlist || watchlist.length === 0) {
    watchlistContainer.innerHTML = `
      <div class="empty-watchlist">
        <p>Your watchlist is empty</p>
        <p>Visit Amazon to start tracking products</p>
      </div>
    `
    return
  }

  let html = ""

  watchlist.forEach((item) => {
    html += `
      <div class="watchlist-item" data-asin="${item.asin}">
        <img src="${item.imageUrl || "placeholder.png"}" alt="${item.title}">
        <div class="watchlist-item-details">
          <div class="watchlist-item-title">${item.title}</div>
          <div class="watchlist-item-price">
            <span class="watchlist-item-signal signal-${item.dealSignal}"></span>
            $${item.currentPrice.toFixed(2)}
          </div>
        </div>
        <button class="watchlist-item-remove" data-asin="${item.asin}">×</button>
      </div>
    `
  })

  watchlistContainer.innerHTML = html

  // Add event listeners for remove buttons
  document.querySelectorAll(".watchlist-item-remove").forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.stopPropagation()
      const asin = button.getAttribute("data-asin")

      try {
        await window.chrome.runtime.sendMessage({
          type: "REMOVE_FROM_WATCHLIST",
          asin,
        })

        // Remove from DOM
        document.querySelector(`.watchlist-item[data-asin="${asin}"]`).remove()

        // Check if watchlist is now empty
        if (document.querySelectorAll(".watchlist-item").length === 0) {
          renderWatchlist([])
        }
      } catch (error) {
        console.error("Error removing item from watchlist:", error)
      }
    })
  })

  // Add click event to open product page
  document.querySelectorAll(".watchlist-item").forEach((item) => {
    item.addEventListener("click", () => {
      const asin = item.getAttribute("data-asin")
      window.chrome.tabs.create({ url: `https://www.amazon.com/dp/${asin}` })
    })
  })
}
