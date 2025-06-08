// We need node-fetch to make HTTP requests to the Telegram API
const fetch = require('node-fetch');

// The main handler function for the Netlify Function
exports.handler = async (event) => {
  // We only want to handle POST requests from Telegram
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Get the bot token from environment variables for security
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) {
      throw new Error("Telegram Bot Token not found in environment variables.");
    }

    // Parse the incoming update from Telegram
    const update = JSON.parse(event.body);

    // Make sure it's a message and it has text
    if (!update.message || !update.message.text) {
      return { statusCode: 200, body: 'OK: Not a text message' };
    }

    const message = update.message;
    const text = message.text;
    const chatId = message.chat.id;

    // Regex to find all URLs in the message text
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex);

    // If no URLs are found, do nothing
    if (!urls) {
      return { statusCode: 200, body: 'OK: No URLs found' };
    }

    let replyText = '';

    // Loop through all found URLs to find a match
    for (const url of urls) {
      if (url.includes('instagram.com')) {
        // For Instagram, replace the domain with ddinstagram.com
        replyText = url.replace('instagram.com', 'ddinstagram.com');
        break; // Stop after finding the first valid link
      } else if (url.includes('facebook.com') || url.includes('fb.watch')) {
        // For Facebook, there's no perfect "dd" equivalent.
        // The most reliable way for a bot is to simply re-post the link.
        // Telegram often generates a preview for a bot's message when it fails for a user's.
        replyText = url;
        break; // Stop after finding the first valid link
      }
    }

    // If we found a link to fix, send a reply
    if (replyText) {
      const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      await fetch(telegramApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
          // Optional: reply to the original message
          // reply_to_message_id: message.message_id 
        }),
      });
    }

    // Return a 200 OK to Telegram to acknowledge receipt of the update
    return { statusCode: 200, body: 'OK: Processed' };

  } catch (error) {
    console.error('Error processing update:', error);
    // Return 200 even on errors, so Telegram doesn't keep resending the same update
    return { statusCode: 200, body: 'OK: Error processing' };
  }
};