const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const EXTENSION_API_KEY = process.env.EXTENSION_API_KEY;
const VALID_EXTENSION_IDS = (process.env.VALID_EXTENSION_IDS || '').split(',');

exports.handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key,X-Extension-Id',
        'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'CORS preflight successful' })
        };
    }

    const headers = event.headers || {};
    const apiKey = headers['x-api-key'] || headers['X-Api-Key'] || '';
    const extensionId = headers['x-extension-id'] || headers['X-Extension-Id'] || '';

    if (apiKey !== EXTENSION_API_KEY || !VALID_EXTENSION_IDS.includes(extensionId)) {
        return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Unauthorized' })
        };
    }

    const { httpMethod, queryStringParameters, body } = event;

    if (httpMethod === 'POST') {
        try {
            const { asin, priceData } = JSON.parse(body || '{}');

            if (!asin || !priceData) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Missing asin or priceData' }),
                };
            }

            const response = await fetch(`${SUPABASE_URL}/rest/v1/price_history`, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    Prefer: 'resolution=merge-duplicates'
                },
                body: JSON.stringify({ asin, price_data: priceData })
            });

            const result = await response.json();

            return {
                statusCode: response.ok ? 200 : 500,
                headers: corsHeaders,
                body: JSON.stringify(response.ok ? { success: true } : { error: 'Insert failed', details: result }),
            };
        } catch (err) {
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Internal error', details: err.message }),
            };
        }
    }

    if (httpMethod === 'GET') {
        const asin = queryStringParameters?.asin;

        if (!asin) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Missing asin parameter' }),
            };
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/price_history?asin=eq.${asin}`, {
            method: 'GET',
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                Accept: 'application/json',
            }
        });

        const result = await response.json();

        if (!response.ok || result.length === 0) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'No price history found' }),
            };
        }

        const entry = result[0];
        const createdAt = new Date(entry.created_at);
        const isFresh = Date.now() - createdAt.getTime() < 6 * 60 * 60 * 1000;

        if (!isFresh) {
            return {
                statusCode: 410,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Cached data expired' }),
            };
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ success: true, priceData: entry.price_data }),
        };
    }

    return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
};
