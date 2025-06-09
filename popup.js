document.addEventListener("DOMContentLoaded", async () => {
  // Load watchlist
  const watchlistContainer = document.getElementById("watchlist-container");
  const amazonBtn = document.getElementById("amazon-button");
  const signInButton = document.getElementById('signin-button');
  const userInfo = document.querySelector('.user-info');
  const userEmail = document.querySelector('.user-email');
  const signoutButton = document.getElementById('signout-button');

  // Initialize Firebase first
  try {
    const firebaseService = window.firebaseService;
    if (!firebaseService) {
      throw new Error('Firebase service not available');
    }
    await firebaseService.initializeFirebase();
    console.log('Firebase initialized in popup');

    amazonBtn?.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://www.amazon.com" });
    });

    // Check user state after Firebase is initialized
    chrome.storage.local.get('user', (data) => {
      console.log('User data:', data.user);
      if (data.user) {
        // User is signed in
        signInButton.style.display = 'none';
        userInfo.style.display = 'flex';
        userEmail.textContent = data.user.email;
        
        // Handle sign out
        signoutButton.addEventListener('click', async () => {
          try {
            await firebaseService.signOut();
            await chrome.storage.local.remove('user');
            window.location.reload();
          } catch (error) {
            console.error('Sign out error:', error);
          }
        });
      } else {
        // User is not signed in
        signInButton.style.display = 'block';
        userInfo.style.display = 'none';
        
        signInButton.addEventListener('click', () => {
          chrome.windows.create({
            url: 'signin.html',
            type: 'popup',
            width: 400,
            height: 600,
            left: screen.width/2 - 200,
            top: screen.height/2 - 300
          });
        });
      }
    });
  } catch (error) {
    console.error('Popup initialization error:', error);
    // Handle initialization error (maybe show error state in UI)
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
