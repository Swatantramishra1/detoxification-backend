const fetch = require('node-fetch');
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:8888/.netlify/functions/oauth2callback`;
const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

exports.handler = async (event, context) => {
  const tokens = JSON.parse(event.headers['x-tokens']);
  if (!tokens) {
    return {
      statusCode: 302,
      headers: {
        Location: '/.netlify/functions/auth',
      },
    };
  }

  try {
    const response = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch playlists: ${response.statusText}, Response: ${errorText}`);
      throw new Error(`Failed to fetch playlists: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error fetching playlists', error);
    return {
      statusCode: 500,
      body: 'Failed to fetch playlists',
    };
  }
};
