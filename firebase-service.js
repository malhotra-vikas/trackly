class FirebaseService {
  constructor() {
    this.auth = null;
    this.initialized = false;
    this.errorMessages = {
      'auth/invalid-login-credentials': 'Invalid email or password. Please try again.',
      'auth/user-not-found': 'No account found with this email. Please sign up.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/email-already-in-use': 'An account already exists with this email. Please sign in.',
      'auth/weak-password': 'Password should be at least 6 characters long.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'default': 'An error occurred. Please try again.'
    };
  }

  getErrorMessage(error) {
    return this.errorMessages[error.code] || this.errorMessages.default;
  }

  async initSupabase() {
    const keys = await chrome.storage.local.get(["supabaseUrl", "supabaseKey"]);
    if (!keys.supabaseUrl || !keys.supabaseKey) {
      throw new Error("❌ Missing Supabase keys");
    }

    this.SUPABASE_URL = keys.supabaseUrl;
    this.SUPABASE_KEY = keys.supabaseKey;

    this.supabaseHeaders = {
      'apikey': this.SUPABASE_KEY,
      'Authorization': `Bearer ${this.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    };

    console.log("✅ Supabase initialized");
  }

  async initializeFirebase() {
    if (this.initialized) return;

    try {
      // Get Firebase config
      const keys = await chrome.storage.local.get([
        "firebaseApiKey",
        "firebaseAuthDomain",
        "firebaseProjectId",
        "firebaseAppId",
        "firebaseMeasurementId",
        "firebaseMessagingSenderId",
        "firebaseStorageBucketId"
      ]);

      // Validate required keys
      if (!keys.firebaseApiKey || !keys.firebaseAuthDomain) {
        throw new Error('Missing required Firebase configuration');
      }

      const firebaseConfig = {
        apiKey: keys.firebaseApiKey,
        authDomain: keys.firebaseAuthDomain,
        projectId: keys.firebaseProjectId,
        storageBucket: keys.firebaseStorageBucketId,
        messagingSenderId: keys.firebaseMessagingSenderId,
        appId: keys.firebaseAppId
      };

      // Initialize Firebase
      firebase.initializeApp(firebaseConfig);
      this.auth = firebase.auth();

      await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

      this.initialized = true;
      console.log('Firebase initialized successfully');

      return true;
    } catch (error) {
      console.error('Firebase initialization error:', error);
      throw error;
    }
  }

  async signIn(email, password) {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    try {
      const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  }

  async signUp(email, password) {

    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    try {
      const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);

      const user = userCredential.user;
      const extensionUserId = user.uid;
      const installDate = new Date().toISOString();

      console.log("✅ Firebase user created:", extensionUserId);

      await this.initSupabase();

      // Create SupaBase user too
      await this.createUser(email, installDate);
      console.log("✅ Supabase user created");

      return { success: true, user: user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    try {
      await this.auth.signOut();
      return { success: true };
    } catch (error) {
      console.error('Sign out   error:', error);
      return { success: false, error: error.message };
    }
  }

  getCurrentUser() {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    const user = this.auth.currentUser;
    if (!user) {
      return null;
    }
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified
    };
  }

  onAuthStateChanged(callback) {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    return this.auth.onAuthStateChanged(callback);
  }

  // Adding Supabase actions
  async createUser(email, installDate = new Date().toISOString()) {
    console.log("📌 createUser called with:", email);
    const exists = await this.getUserByExtensionId(email);
    if (exists) {
      console.log("✅ User already exists:", exists);
      return exists;
    }

    const payload = {
      extension_user_id: email,
      install_date: installDate,
      last_active: new Date().toISOString()
    };

    console.log("📌 createUser called with payload:", payload);

    const response = await fetch(`${this.SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        ...this.supabaseHeaders,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("🧾 Supabase createUser response:", result);
    return result;
  }

  async getUserByExtensionId(extensionUserId) {
    const url = `${this.SUPABASE_URL}/rest/v1/users?extension_user_id=eq.${extensionUserId}&select=*`;
    const response = await fetch(url, { headers: this.supabaseHeaders });
    const data = await response.json();
    return data.length > 0 ? data[0] : null;
  }

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

    const response = await fetch(`${this.SUPABASE_URL}/rest/v1/watchlist_items`, {
      method: 'POST',
      headers: {
        ...this.supabaseHeaders,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload)
    });

    return await response.json();
  }

  async removeFromWatchlist(userId, asin) {
    const url = `${this.SUPABASE_URL}/rest/v1/watchlist_items?user_id=eq.${userId}&asin=eq.${asin}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.supabaseHeaders
    });
    return response.ok;
  }

  async isInWatchlist(userId, asin) {
    const url = `${this.SUPABASE_URL}/rest/v1/watchlist_items?user_id=eq.${userId}&asin=eq.${asin}`;
    const response = await fetch(url, { headers: this.supabaseHeaders });
    const data = await response.json();
    return data.length > 0;
  }

  async getWatchlist(userId) {
    const url = `${this.SUPABASE_URL}/rest/v1/watchlist_items?user_id=eq.${userId}`;
    const response = await fetch(url, { headers: this.supabaseHeaders });
    return await response.json();
  }

  async setPriceHistory(asin, priceData) {
    const response = await fetch(`${this.SUPABASE_URL}/rest/v1/price_history`, {
      method: 'POST',
      headers: {
        ...this.supabaseHeaders,
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ asin, price_data: priceData })
    });

    return await response.json();
  }

  async getPriceHistory(asin) {
    const url = `${this.SUPABASE_URL}/rest/v1/price_history?asin=eq.${asin}&select=*`;
    const response = await fetch(url, { headers: this.supabaseHeaders });
    const data = await response.json();
    return data.length > 0 ? data[0].price_data : null;
  }

}

// Create global instance
window.firebaseService = new FirebaseService();