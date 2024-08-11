const fetch = require('node-fetch');
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = '301935423069-jigd73ekh4dob8ejbl9h3ckatpfmc5nd.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
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

  const { name, numVideos = 10, includeKeywords = [], excludeKeywords = [], description = '' } = JSON.parse(event.body);

  if (!name || typeof parseInt(numVideos, 10) !== 'number' || parseInt(numVideos, 10) <= 0) {
    return {
      statusCode: 400,
      body: 'Invalid input data',
    };
  }

  const includeKeywordsArray = includeKeywords.map((keyword) => keyword.trim()).filter(Boolean);
  const excludeKeywordsArray = excludeKeywords ? excludeKeywords.map((keyword) => keyword.trim()).filter(Boolean) : [];

  try {
    const playlistResponse = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          title: name,
          description: description,
          defaultLanguage: 'en',
        },
        status: {
          privacyStatus: 'public',
        },
      }),
    });

    if (!playlistResponse.ok) {
      const errorText = await playlistResponse.text();
      console.error(`Failed to create playlist: ${playlistResponse.statusText}, Response: ${errorText}`);
      throw new Error(`Failed to create playlist: ${playlistResponse.statusText}`);
    }

    const playlistData = await playlistResponse.json();
    const playlistId = playlistData.id;

    const existingVideos = new Set();

    const fetchExistingVideos = async () => {
      let nextPageToken = '';
      do {
        const playlistItemsResponse = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}`, {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        });
        if (!playlistItemsResponse.ok) {
          const errorText = await playlistItemsResponse.text();
          console.error(`Failed to fetch playlist items: ${playlistItemsResponse.statusText}, Response: ${errorText}`);
          throw new Error(`Failed to fetch playlist items: ${playlistItemsResponse.statusText}`);
        }

        const playlistItemsData = await playlistItemsResponse.json();
        playlistItemsData.items.forEach((item) => existingVideos.add(item.snippet.resourceId.videoId));

        nextPageToken = playlistItemsData.nextPageToken;
      } while (nextPageToken);
    };

    await fetchExistingVideos();

    const videoIds = new Set();
    for (const keyword of includeKeywordsArray) {
      let nextPageToken = '';
      do {
        const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(keyword)}&key=${CLIENT_ID}&pageToken=${nextPageToken}`, {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        });
        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          console.error(`Search request failed for keyword "${keyword}": ${searchResponse.statusText}, Response: ${errorText}`);
          throw new Error(`Search request failed for keyword "${keyword}": ${searchResponse.statusText}`);
        }

        const searchData = await searchResponse.json();
        searchData.items.forEach((item) => {
          if (
            item.snippet &&
            item.snippet.title &&
            !excludeKeywordsArray.some((exclude) => item.snippet.title.includes(exclude)) &&
            !existingVideos.has(item.id.videoId)
          ) {
            videoIds.add(item.id.videoId);
          }
        });

        nextPageToken = searchData.nextPageToken;
      } while (nextPageToken && videoIds.size < parseInt(numVideos, 10));
    }

    const limitedVideoIds = Array.from(videoIds).slice(0, parseInt(numVideos, 10));

    for (const videoId of limitedVideoIds) {
      try {
        const addVideoResponse = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            snippet: {
              playlistId: playlistId,
              resourceId: {
                kind: 'youtube#video',
                videoId: videoId,
              },
            },
          }),
        });

        if (!addVideoResponse.ok) {
          const errorText = await addVideoResponse.text();
          if (addVideoResponse.status === 409) {
            console.warn(`Video ID "${videoId}" already in playlist, skipping. Response: ${errorText}`);
          } else {
            console.error(`Failed to add video ID "${videoId}" to playlist: ${addVideoResponse.statusText}, Response: ${errorText}`);
            throw new Error(`Failed to add video ID "${videoId}" to playlist: ${addVideoResponse.statusText}`);
          }
        }
      } catch (error) {
        console.error(`Error adding video ID "${videoId}" to playlist:`, error);
      }
    }

    return {
      statusCode: 200,
      body: `Playlist created and updated with videos. Playlist ID: ${playlistId}`,
    };
  } catch (error) {
    console.error('Error creating or updating playlist', error);
    return {
      statusCode: 500,
      body: 'Failed to create or update playlist',
    };
  }
};
