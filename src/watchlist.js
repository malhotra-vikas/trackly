let currentPage = 1;
const ITEMS_PER_PAGE = 12;
let totalItems = 0;
let currentUser = null; // Add this global user variable

async function initWatchlist() {
    try {
        const firebaseService = window.firebaseService;
        await firebaseService.initializeFirebase();
        
        // Store user globally
        currentUser = await new Promise((resolve) => {
            const unsubscribe = firebaseService.auth.onAuthStateChanged((user) => {
                unsubscribe(); 
                resolve(user);
            });
        });
        
        if (!currentUser) {
            window.location.href = 'signin.html';
            return;
        }

        await loadWatchlistItems(); // Remove user parameter
    } catch (error) {
        console.error(error);
    }
}

// Update loadWatchlistItems to use global user
async function loadWatchlistItems() {
    const grid = document.getElementById('watchlist-grid');
    const loading = document.getElementById('loading');
    
    try {
        if (!currentUser) {
            throw new Error('No authenticated user found');
        }

        // Add overlay
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        document.body.appendChild(overlay);
        
        loading.style.display = 'flex';
        grid.classList.add('loading');

        const result = await window.tracklySupabase.getWatchlistItems(currentUser.uid);
        
        if (!result.success) {
            throw new Error(result.error);
        }

        totalItems = result.items.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        
        updatePagination(totalPages);
        renderItems(result.items);

    } catch (error) {
        console.error('Error loading watchlist:', error);
        showToast(error.message, 'error');
    } finally {
        // Remove overlay
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        loading.style.display = 'none';
        grid.classList.remove('loading');
    }
}

// Update removeFromWatchlist to use global user
async function removeFromWatchlist(asin) {
    try {
        if (!currentUser) {
            showToast('Please sign in to remove items', 'error');
            return;
        }

        const response = await window.tracklySupabase.removeFromWatchlist(
            currentUser.uid,
            asin
        );

        if (response && response.success) {
            const itemElement = document.querySelector(`[data-asin="${asin}"]`);
            if (itemElement) {
                itemElement.remove();
            }
            
            await loadWatchlistItems();
            showToast('Item removed from watchlist');
        } else {
            throw new Error('Failed to remove item');
        }
    } catch (error) {
        console.error('Error removing item:', error);
        showToast(error.message, 'error');
    }
}

// Add toast function if not already present
function showToast(message, type = 'success') {
    const colors = {
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B'
    };

    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        close: true,
        style: {
            background: colors[type],
            borderRadius: "8px",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
        },
        className: "trackly-toast",
        onClick: function() {
            this.hideToast();
        }
    }).showToast();
}

// Update the renderItems function to remove inline handlers
function renderItems(items) {
    const grid = document.getElementById('watchlist-grid');
    const pagination = document.querySelector('.pagination');
    
    if (!items?.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"></path>
                    <path d="M15 2H9a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z"></path>
                </svg>
                <h2>Your watchlist is empty</h2>
                <p>Start adding products to track their prices!</p>
            </div>
        `;
        // Hide pagination when no items
        pagination.style.display = 'none';
        return;
    }

    // Show pagination when items exist
    pagination.style.display = 'flex';
    
    grid.innerHTML = items.map(item => `
        <div class="product-card" data-asin="${item.asin}">
            <div class="image-container">
                <img class="product-image" src="${item.image_url}" alt="${item.title}">
            </div>
            <div class="product-info">
                <h3 class="product-title">${item.title}</h3>
                <p class="product-price">$${item.current_price.toFixed(2)}</p>
            </div>
            <div class="product-actions">
                <a href="${item.product_url}" target="_blank" class="btn view-btn">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/>
                    </svg>
                    View
                </a>
                <button class="btn remove-btn" data-asin="${item.asin}">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/>
                    </svg>
                    Remove
                </button>
            </div>
        </div>
    `).join('');

    // Add event listeners after rendering
    attachRemoveButtonListeners();
}

// Add this new function to handle remove button event listeners
function attachRemoveButtonListeners() {
    const removeButtons = document.querySelectorAll('.remove-btn');
    removeButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const asin = e.currentTarget.dataset.asin;
            if (asin) {
                await removeFromWatchlist(asin);
            }
        });
    });
}

function updatePagination(totalPages) {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

// Event Listeners
function setupEventListeners() {
    document.getElementById('prev-page')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadWatchlistItems();
        }
    });

    document.getElementById('next-page')?.addEventListener('click', () => {
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        if (currentPage < totalPages) {
            currentPage++;
            loadWatchlistItems();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initWatchlist();
});