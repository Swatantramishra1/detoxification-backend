const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:8888/.netlify/functions/oauth2callback`;
const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

exports.handler = async (event, context) => {
  const scopes = ['https://www.googleapis.com/auth/youtube'];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    response_type: 'code',
  });

  return {
    statusCode: 302,
    headers: {
      Location: url,
    },
  };
};
