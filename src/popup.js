document.addEventListener("DOMContentLoaded", async () => {
  // Load watchlist
  const watchlistContainer = document.getElementById("watchlist-container");
  const amazonBtn = document.getElementById("amazon-button");
  const signInButton = document.getElementById('signin-button');
  const userInfo = document.querySelector('.user-info');
  const userEmail = document.querySelector('.user-email');
  const signoutButton = document.getElementById('signout-button');

  // Initialize Sppabase and Firebase first
  try {
    // Wait for Supabase to be ready first
    const supabaseLite = await window.supabaseLiteReady;
    console.log("✅ SupabaseLite ready in popup.js:", supabaseLite);

    // Initialize Firebase next
    console.log('🟡 Skipping Firebase init – handled via backend login flow');

    // Add Amazon button event
    amazonBtn?.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://www.amazon.com" });
    });

    const watchlistButton = document.getElementById('watchlist-view-btn');

    // Check user state after Firebase is initialized
    chrome.storage.local.get('user', (data) => {
      console.log('User data:', data.user);
      if (data.user) {
        // User is signed in
        signInButton.style.display = 'none';
        watchlistButton.style.display = 'flex';
        userInfo.style.display = 'flex';
        userEmail.textContent = data.user.email;
        watchlistButton.style.display = 'flex';
        
        // Handle sign out
        signoutButton.addEventListener('click', async () => {
          try {
            await firebaseService.signOut();
            await chrome.storage.local.remove('user');
            window.location.reload();
          } catch (error) {
            console.error('❌ Sign out error:', error);
          }
        });

        // TODO: Load watchlist here if you wish using supabaseLite.getWatchlist(data.user.uid)
      } else {
        // User is not signed in
        signInButton.style.display = 'flex';
        watchlistButton.style.display = 'none';
        userInfo.style.display = 'none';
         watchlistButton.style.display = 'none';
        
        signInButton.addEventListener('click', () => {
          chrome.windows.create({
            url: 'signin.html',
            type: 'popup',
            width: 400,
            height: 600,
            left: screen.width / 2 - 200,
            top: screen.height / 2 - 300
          });
        });
      }
    });

    // Add watchlist button click handler
    watchlistButton.addEventListener('click', () => {
      chrome.tabs.create({ 
          url: chrome.runtime.getURL('watchlist.html')
      });
    });
  } catch (error) {
    console.error('❌ Popup initialization error:', error);
  }

  // Settings toggle (future use)
  const notificationToggle = document.getElementById("notification-toggle");

  // Analytics button
  document.getElementById("view-analytics").addEventListener("click", () => {
    window.chrome.tabs.create({ url: window.chrome.runtime.getURL("analytics.html") })
  })
   document.getElementById("watchlist-view-btn").addEventListener("click", () => {
      chrome.tabs.create({ 
          url: chrome.runtime.getURL('watchlist.html')
      });
  });
  
})

function renderWatchlist(watchlist) {
  const watchlistContainer = document.getElementById("watchlist-container");

  if (!watchlist || watchlist.length === 0) {
    watchlistContainer.innerHTML = `
      <div class="empty-watchlist">
        <p>Your watchlist is empty</p>
        <p>Visit Amazon to start tracking products</p>
      </div>
    `;
    return;
  }

  let html = "";

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
    `;
  });

  watchlistContainer.innerHTML = html;

  document.querySelectorAll(".watchlist-item-remove").forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.stopPropagation();
      const asin = button.getAttribute("data-asin");

      try {
        await window.chrome.runtime.sendMessage({
          type: "REMOVE_FROM_WATCHLIST",
          asin,
        });

        document.querySelector(`.watchlist-item[data-asin="${asin}"]`).remove();

        if (document.querySelectorAll(".watchlist-item").length === 0) {
          renderWatchlist([]);
        }
      } catch (error) {
        console.error("Error removing item from watchlist:", error);
      }
    });
  });

  document.querySelectorAll(".watchlist-item").forEach((item) => {
    item.addEventListener("click", () => {
      const asin = item.getAttribute("data-asin");
      window.chrome.tabs.create({ url: `https://www.amazon.com/dp/${asin}` });
    });
  });
}
