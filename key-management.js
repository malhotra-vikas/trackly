// Key management for Trackly

// Configuration
const SECRETS_ENDPOINT = "https://evpxv92u1l.execute-api.us-east-2.amazonaws.com/PROD/secrets"
const EXTENSION_API_KEY = "aa79fb2656c48210d7d9cfa3821ff6f4"
const SECRETS_CACHE_KEY = "trackly_secrets_cache"
const SECRETS_EXPIRY_KEY = "trackly_secrets_expiry"

// Declare chrome variable
const chrome = window.chrome || {}

// Function to check if keys are set
async function checkKeys() {
    const data = await chrome.storage.local.get([
        "supabaseUrl",
        "supabaseKey",
        "keepaKey",
        "firebaseApiKey",
        "firebaseAuthDomain",
        "firebaseProjectId",
        "firebaseAppId",
    ])
    return {
        hasSupabaseKeys: !!(data.supabaseUrl && data.supabaseKey),
        hasKeepaKey: !!data.keepaKey,
        hasFirebaseKeys: !!(data.firebaseApiKey && data.firebaseAuthDomain && data.firebaseProjectId && data.firebaseAppId),
    }
}

// Function to save keys
async function saveKeys(keys) {
    await chrome.storage.local.set(keys)
    return true
}

// Function to get keys
async function getKeys() {
    return await chrome.storage.local.get([
        "firebaseApiKey",
        "firebaseAuthDomain",
        "firebaseProjectId",
        "firebaseAppId",
        "firebaseMeasurementId",
        "firebaseMessagingSenderId",
        "firebaseStorageBucketId",
        "openaiApiKey",
        "supabaseUrl",
        "supabaseKey",
        "keepaKey"
    ]);
}

// Function to fetch secrets from Lambda
async function fetchSecrets() {
    console.log("Trackly: Fetching secrets from Lambda")

    // Check if we have cached secrets that haven't expired
    const cache = await chrome.storage.local.get([SECRETS_CACHE_KEY, SECRETS_EXPIRY_KEY])
    const now = Date.now()

    if (cache[SECRETS_CACHE_KEY] && cache[SECRETS_EXPIRY_KEY] && now < cache[SECRETS_EXPIRY_KEY]) {
        console.log("Trackly: Using cached secrets")
        return cache[SECRETS_CACHE_KEY]
    }

    try {
        // Get the extension ID
        const extensionId = chrome.runtime.id

        console.log("Trackly: Making request to Lambda with extension ID:", extensionId)

        // Fetch secrets from Lambda
        const response = await fetch(SECRETS_ENDPOINT, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-Api-Key": EXTENSION_API_KEY,
                "X-Extension-Id": extensionId,
            },
        })

        console.log("Trackly: Lambda response status:", response.status)

        if (!response.ok) {
            const errorText = await response.text()
            console.error("Trackly: Lambda error response:", errorText)
            throw new Error(`Failed to fetch secrets: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        console.log("Trackly: Secrets fetched successfully from Lambda")

        if (!result.success) {
            throw new Error(`API returned error: ${result.error || "Unknown error"}`)
        }

        const secrets = result.data

        // Cache the secrets
        await chrome.storage.local.set({
            [SECRETS_CACHE_KEY]: secrets,
            [SECRETS_EXPIRY_KEY]: result.expiresAt,
        })

        await saveKeys({
            supabaseUrl: secrets.supabaseUrl,
            supabaseKey: secrets.supabaseKey,
            keepaKey: secrets.keepaApiKey,
            firebaseApiKey: secrets.firebaseApiKey,
            firebaseAuthDomain: secrets.firebaseAuthDomain,
            firebaseProjectId: secrets.firebaseProjectId,
            firebaseAppId: secrets.firebaseAppId,
            firebaseMeasurementId: secrets.firebaseMeasurementId,
            firebaseMessagingSenderId: secrets.firebaseMessagingSenderId,
            firebaseStorageBucketId: secrets.firebaseStorageBucketId,
            openaiApiKey: secrets.openaiApiKey
        })

        console.log("Trackly: Secrets fetched and cached successfully")
        return secrets
    } catch (error) {
        console.error("Trackly: Error fetching secrets:", error)

        // Return any cached secrets even if expired
        if (cache[SECRETS_CACHE_KEY]) {
            console.warn("Trackly: Using expired cached secrets")
            return cache[SECRETS_CACHE_KEY]
        }

        throw error
    }
}

// Function to initialize keys
async function initializeKeys() {
    console.log("Trackly: Initializing keys...")

    try {
        await fetchSecrets()
        console.log("Trackly: Keys initialized successfully")
        return true
    } catch (error) {
        console.error("Trackly: Failed to initialize keys:", error)

        const keysExist = await checkKeys()
        if (keysExist.hasSupabaseKeys && keysExist.hasKeepaKey && keysExist.hasFirebaseKeys) {
            console.log("Trackly: Using existing cached keys")
            return true
        }

        return false
    }
}

// Expose to global scope
const tracklyKeys = {
    async getKeys() {
        return new Promise((resolve) => {
            chrome.storage.local.get([
                "firebaseApiKey",
                "firebaseAuthDomain",
                "firebaseProjectId",
                "firebaseAppId",
                "firebaseMeasurementId",
                "firebaseMessagingSenderId",
                "firebaseStorageBucketId",
                "openaiApiKey",
                "supabaseUrl",
                "supabaseKey",
                "keepaKey"
            ], resolve);
        });
    },

    async fetchSecrets() {
        try {
            const keys = await this.getKeys();
            return {
                firebaseConfig: {
                    apiKey: keys.firebaseApiKey,
                    authDomain: keys.firebaseAuthDomain,
                    projectId: keys.firebaseProjectId,
                    storageBucket: keys.firebaseStorageBucketId,
                    messagingSenderId: keys.firebaseMessagingSenderId,
                    appId: keys.firebaseAppId
                }
            };
        } catch (error) {
            console.error('Error fetching secrets:', error);
            throw error;
        }
    }
};

// Export to global scope
window.tracklyKeys = tracklyKeys;
