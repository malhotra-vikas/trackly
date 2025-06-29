// supabase-lite.js
console.log("🟨 Starting supabase-lite.js...");

window.supabaseLiteReady = new Promise(async (resolve, reject) => {
    try {
        const keys = await chrome.storage.local.get(["supabaseUrl", "supabaseKey"]);

        if (!keys.supabaseUrl || !keys.supabaseKey) {
            return reject("❌ Missing Supabase keys in chrome.storage.local");
        }

        const SUPABASE_URL = keys.supabaseUrl;
        const SUPABASE_ANON_KEY = keys.supabaseKey;

        const defaultHeaders = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
        };

        const supabaseLite = {
            async createUser(extensionUserId, installDate = new Date().toISOString()) {
                console.log("📌 createUser called with:", extensionUserId);
                const exists = await supabaseLite.getUserByExtensionId(extensionUserId);
                if (exists) {
                    console.log("✅ User already exists:", exists);
                    return exists;
                }

                const payload = {
                    extension_user_id: extensionUserId,
                    install_date: installDate,
                    last_active: new Date().toISOString()
                };

                const response = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
                    method: 'POST',
                    headers: {
                        ...defaultHeaders,
                        Prefer: 'return=representation',
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                console.log("🧾 Supabase createUser response:", result);
                return result;
            },

            async getUserByExtensionId(extensionUserId) {
                const url = `${SUPABASE_URL}/rest/v1/users?extension_user_id=eq.${extensionUserId}&select=*`;
                const response = await fetch(url, { headers: defaultHeaders });
                const data = await response.json();
                return data.length > 0 ? data[0] : null;
            },

            async addToWatchlist(userId, product) {
                const payload = {
                    user_id: userId,
                    asin: product.asin,
                    title: product.title,
                    current_price: product.currentPrice,
                    deal_signal: product.dealSignal || 'none',
                    image_url: product.imageUrl,
                    product_url: product.url
                };

                const response = await fetch(`${SUPABASE_URL}/rest/v1/watchlist_items`, {
                    method: 'POST',
                    headers: {
                        ...defaultHeaders,
                        Prefer: 'return=representation',
                    },
                    body: JSON.stringify(payload)
                });

                return await response.json();
            },

            async removeFromWatchlist(userId, asin) {
                const url = `${SUPABASE_URL}/rest/v1/watchlist_items?user_id=eq.${userId}&asin=eq.${asin}`;
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: defaultHeaders
                });
                return response.ok;
            },

            async isInWatchlist(userId, asin) {
                const url = `${SUPABASE_URL}/rest/v1/watchlist_items?user_id=eq.${userId}&asin=eq.${asin}`;
                const response = await fetch(url, { headers: defaultHeaders });
                const data = await response.json();
                return data.length > 0;
            },

            async getWatchlist(userId) {
                const url = `${SUPABASE_URL}/rest/v1/watchlist_items?user_id=eq.${userId}`;
                const response = await fetch(url, { headers: defaultHeaders });
                return await response.json();
            },

            async setPriceHistory(asin, priceData) {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/price_history`, {
                    method: 'POST',
                    headers: {
                        ...defaultHeaders,
                        Prefer: 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify({ asin, price_data: priceData })
                });

                return await response.json();
            },

            async getPriceHistory(asin) {
                const url = `${SUPABASE_URL}/rest/v1/price_history?asin=eq.${asin}&select=*`;
                const response = await fetch(url, { headers: defaultHeaders });
                const data = await response.json();
                return data.length > 0 ? data[0].price_data : null;
            }
        };

        window.supabaseLite = supabaseLite;
        console.log("✅ supabaseLite initialized");
        resolve(supabaseLite);

    } catch (err) {
        console.error("❌ Failed to initialize supabaseLite:", err);
        reject(err);
    }
});
