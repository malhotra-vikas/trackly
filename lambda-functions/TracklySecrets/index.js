// Lambda function to securely provide API keys to the Trackly extension
exports.handler = async (event) => {
    console.log('Received request for secrets');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers, null, 2));

    // CORS headers for all responses
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*', // Restrict to your extension ID in production
        'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key,X-Extension-Id',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS preflight request');
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'CORS preflight successful' })
        };
    }

    // Parse request
    const headers = event.headers || {};
    // Validate API key (this should be a secure, randomly generated key)
    const apiKey = headers['x-api-key'] || headers['X-Api-Key'] || '';
    const expectedApiKey = process.env.EXTENSION_API_KEY;

    if (apiKey !== expectedApiKey) {
        console.log('Invalid API key. Received:', apiKey);
        return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Unauthorized' })
        };
    }

/*
    // Get extension ID for verification
    const extensionId = headers['x-extension-id'] || headers['X-Extension-Id'] || '';
    const validExtensionIds = (process.env.VALID_EXTENSION_IDS || '').split(',');
    if (!validExtensionIds.includes(extensionId)) {
        console.log('Invalid extension ID. Received:', extensionId, 'Valid IDs:', validExtensionIds);
        return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Unauthorized extension' })
        };
    }
*/
    // Return the requested secrets
    const secrets = {
        // Keppa Keys
        keepaApiKey: process.env.KEEPA_API_KEY || '',

        // Supabase Keys
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseKey: process.env.SUPABASE_ANON_KEY || '',

        // Firebase keys
        firebaseApiKey: process.env.FIREBASE_API_KEY || '',
        firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
        firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
        firebaseAppId: process.env.FIREBASE_APP_ID || '',
        firebaseMeasurementId: process.env.FIREBASE_MEASUREMENT_ID || '',
        firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
        firebaseStorageBucketId: process.env.FIREBASE_STORAGE_BUCKET_ID || '',

        //OpenAI Key
        openaiApiKey: process.env.OPENAI_API_KEY
    };

    console.log('Returning secrets successfully');

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            success: true,
            data: secrets,
            expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
        })
    };
};