// Use the global Supabase object instead of importing it
// This assumes you'll include the Supabase CDN script

// Declare the supabaseClient variable
const supabaseClient = window.supabase

//NEXT_PUBLIC_SUPABASE_URL=https://frhtzxqmgycibpzrytcw.supabase.co
//NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyaHR6eHFtZ3ljaWJwenJ5dGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NDUwMTYsImV4cCI6MjA2MzUyMTAxNn0.ISXA-bkPHG4FIPLRJngmeXhWuzXK3sdczzxALAGnl6A

// Initialize Supabase client asynchronously
async function initializeSupabase() {
  try {
    const keys = await chrome.storage.local.get([
      "supabaseUrl",
      "supabaseKey",
    ]);

    // Validate required Supabase keys
    if (!keys.supabaseUrl || !keys.supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    const supabase = supabaseClient.createClient(
      keys.supabaseUrl,
     keys.supabaseKey
    );

    console.log('Supabase client initialized successfully');
    return supabase;
  } catch (error) {
    console.error('Supabase initialization error:', error);
    throw error;
  }
}

// Initialize and export client
let supabaseInstance = null;

async function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = await initializeSupabase();
  }
  return supabaseInstance;
}

// Function to initialize anonymous authentication
async function initAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    // Sign in anonymously
    await supabase.auth.signInAnonymously()
  }

  return supabase.auth.getSession()
}

// Function to get the current user ID
async function getUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.user?.id
}

// Function to sync local user with Supabase
async function syncUser(extensionUserId, installDate) {
  const userId = await getUserId()

  if (!userId) {
    console.error("No authenticated user")
    return null
  }

  // Check if user exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("extension_user_id", extensionUserId)
    .single()

  if (existingUser) {
    // Update last active
    const { data, error } = await supabase
      .from("users")
      .update({ last_active: new Date().toISOString() })
      .eq("extension_user_id", extensionUserId)
      .select()

    if (error) {
      console.error("Error updating user:", error)
    }

    return data
  } else {
    // Create new user
    const { data, error } = await supabase
      .from("users")
      .insert({
        extension_user_id: extensionUserId,
        install_date: installDate || new Date().toISOString(),
        last_active: new Date().toISOString(),
      })
      .select()

    if (error) {
      console.error("Error creating user:", error)
    }

    return data
  }
}

// Function to track an event in Supabase
async function trackEventInSupabase(userId, category, action, properties = {}) {
  const { data, error } = await supabase.from("analytics_events").insert({
    user_id: userId,
    category,
    action,
    properties,
    timestamp: new Date().toISOString(),
  })

  if (error) {
    console.error("Error tracking event in Supabase:", error)
  }

  return data
}

async function getUserId(firebaseUid) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('extension_user_id', firebaseUid)
      .maybeSingle();

    if (error) throw error;
    return data?.id;
  } catch (error) {
    console.error('Error getting user ID:', error);
    throw error;
  }
}

async function addToWatchlist(firebaseUid, product) {
  try {
    const supabase = await getSupabaseClient();
    const userId = await getUserId(firebaseUid);
    if (!userId) {
      throw new Error('User not found');
    }

    const { data, error } = await supabase
      .from('watchlist_items')
      .insert({
        user_id: userId,
        asin: product.asin,
        title: product.title,
        current_price: product.currentPrice,
        deal_signal: product.dealSignal || 'none',
        image_url: product.imageUrl,
        product_url: product.url
      })
      .select();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    return { success: false, error: error.message };
  }
}

async function removeFromWatchlist(firebaseUid, asin) {
  try {
    const supabase = await getSupabaseClient();

    const userId = await this.getUserId(firebaseUid);
    if (!userId) {
      throw new Error('User not found');
    }

    const { error } = await supabase
      .from('watchlist_items')
      .delete()
      .match({ user_id: userId, asin });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    return { success: false, error: error.message };
  }
}

async function isInWatchlist(firebaseUid, asin) {
  try {
    const userId = await this.getUserId(firebaseUid);
    if (!userId) {
      throw new Error('User not found');
    }
    const supabase = await getSupabaseClient();

    const { data, error } = await supabase
      .from('watchlist_items')
      .select('id')
      .match({ user_id: userId, asin })
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return { success: true, isInWatchlist: !!data };
  } catch (error) {
    console.error('Error checking watchlist:', error);
    return { success: false, error: error.message };
  }
}

async function getWatchlistItems(firebaseUid) {
  try {
    const userId = await this.getUserId(firebaseUid);
    if (!userId) {
      throw new Error('User not found');
    }
    const supabase = await getSupabaseClient();

    const { data, error } = await supabase
      .from('watchlist_items')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true, items: data };
  } catch (error) {
    console.error('Error getting watchlist items:', error);
    return { success: false, error: error.message };
  }
}

// Function to get analytics data from Supabase
async function getAnalyticsFromSupabase() {
  const supabase = await getSupabaseClient();

  // Get metrics summary
  const { data: metrics, error: metricsError } = await supabase.from("metrics_summary").select("*").single()

  if (metricsError) {
    console.error("Error fetching metrics:", metricsError)
  }

  // Get recent events
  const { data: events, error: eventsError } = await supabase
    .from("analytics_events")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(1000)

  if (eventsError) {
    console.error("Error fetching events:", eventsError)
  }

  return {
    metrics: metrics || {},
    events: events || [],
  }
}

async function createUserAfterSignup(firebaseUid) {
    try {
        const supabase = await getSupabaseClient();
        if (!supabase) {
            throw new Error('Supabase client not initialized');
        }        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('extension_user_id', firebaseUid)
            .maybeSingle();

        if (existingUser) {
            console.log('User already exists in Supabase');
            return existingUser.id;
        }

        // Insert new user
        const { data, error } = await supabase
            .from('users')
            .insert({
                extension_user_id: firebaseUid,
                install_date: new Date().toISOString(),
                last_active: new Date().toISOString()
            })
            .select('id')
            .single();

        if (error) throw error;

        console.log('User created in Supabase:', data.id);
        return data.id;
    } catch (error) {
        console.error('Error creating user in Supabase:', error);
        throw error;
    }
}

// Export as global variables instead of ES modules
window.tracklySupabase = {
  getSupabaseClient,
  initAuth,
  getUserId,
  syncUser,
  trackEventInSupabase,
  addToWatchlist,
  isInWatchlist,
  getWatchlistItems,
  removeFromWatchlist,
  createUserAfterSignup
}
