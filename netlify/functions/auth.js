const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = '301935423069-jigd73ekh4dob8ejbl9h3ckatpfmc5nd.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
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
