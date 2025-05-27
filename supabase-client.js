// Use the global Supabase object instead of importing it
// This assumes you'll include the Supabase CDN script

// Declare the supabaseClient variable
const supabaseClient = window.supabase

//NEXT_PUBLIC_SUPABASE_URL=https://frhtzxqmgycibpzrytcw.supabase.co
//NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyaHR6eHFtZ3ljaWJwenJ5dGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NDUwMTYsImV4cCI6MjA2MzUyMTAxNn0.ISXA-bkPHG4FIPLRJngmeXhWuzXK3sdczzxALAGnl6A

// Initialize Supabase client
const supabaseUrl = NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = NEXT_PUBLIC_SUPABASE_ANON_KEY

            
// Create the client using the global Supabase object
const supabase = supabaseClient.createClient(supabaseUrl, supabaseKey)

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

// Function to sync watchlist with Supabase
async function syncWatchlistItem(userId, item) {
  const supabaseUserId = await getUserId()

  if (!supabaseUserId) {
    console.error("No authenticated user")
    return null
  }

  // Get the database user ID
  const { data: userData } = await supabase.from("users").select("id").eq("extension_user_id", userId).single()

  if (!userData) {
    console.error("User not found in database")
    return null
  }

  // Check if item exists
  const { data: existingItem } = await supabase
    .from("watchlist_items")
    .select("*")
    .eq("user_id", userData.id)
    .eq("asin", item.asin)
    .single()

  if (existingItem) {
    // Update existing item
    const { data, error } = await supabase
      .from("watchlist_items")
      .update({
        current_price: item.currentPrice,
        deal_signal: item.dealSignal,
        title: item.title,
        image_url: item.imageUrl,
        product_url: item.url,
      })
      .eq("id", existingItem.id)
      .select()

    if (error) {
      console.error("Error updating watchlist item:", error)
    }

    return data
  } else {
    // Create new item
    const { data, error } = await supabase
      .from("watchlist_items")
      .insert({
        user_id: userData.id,
        asin: item.asin,
        title: item.title,
        current_price: item.currentPrice,
        deal_signal: item.dealSignal,
        image_url: item.imageUrl,
        product_url: item.url,
      })
      .select()

    if (error) {
      console.error("Error creating watchlist item:", error)
    }

    return data
  }
}

// Function to remove watchlist item from Supabase
async function removeWatchlistItemFromSupabase(userId, asin) {
  const supabaseUserId = await getUserId()

  if (!supabaseUserId) {
    console.error("No authenticated user")
    return null
  }

  // Get the database user ID
  const { data: userData } = await supabase.from("users").select("id").eq("extension_user_id", userId).single()

  if (!userData) {
    console.error("User not found in database")
    return null
  }

  // Delete the item
  const { data, error } = await supabase.from("watchlist_items").delete().eq("user_id", userData.id).eq("asin", asin)

  if (error) {
    console.error("Error removing watchlist item:", error)
  }

  return data
}

// Function to get analytics data from Supabase
async function getAnalyticsFromSupabase() {
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

// Export as global variables instead of ES modules
window.tracklySupabase = {
  supabase,
  initAuth,
  getUserId,
  syncUser,
  trackEventInSupabase,
  syncWatchlistItem,
  removeWatchlistItemFromSupabase,
  getAnalyticsFromSupabase,
}
