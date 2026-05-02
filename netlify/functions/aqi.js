// Netlify Function: /api/aqi
// Proxies WAQI requests server-side so the token is never exposed to the browser.
//
// Usage:
//   GET /api/aqi?city=Sofia
//   GET /api/aqi?lat=42.69&lon=23.32
//
// Setup: In Netlify dashboard → Site → Environment variables, add:
//   WAQI_TOKEN = your_token_here

const WAQI_BASE = 'https://api.waqi.info/feed';

exports.handler = async (event) => {
  const token = process.env.WAQI_TOKEN;

  if (!token) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Server not configured — WAQI_TOKEN missing.' }),
    };
  }

  const { city, lat, lon } = event.queryStringParameters || {};

  let waqiUrl;
  if (lat && lon) {
    waqiUrl = `${WAQI_BASE}/geo:${lat};${lon}/?token=${token}`;
  } else if (city) {
    waqiUrl = `${WAQI_BASE}/${encodeURIComponent(city)}/?token=${token}`;
  } else {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Provide ?city=Name or ?lat=&lon= query params.' }),
    };
  }

  try {
    const res = await fetch(waqiUrl);
    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // cache 5 min — don't hammer WAQI
        ...corsHeaders(),
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: JSON.stringify({ error: `Upstream fetch failed: ${err.message}` }),
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
