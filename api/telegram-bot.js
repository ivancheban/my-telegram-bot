const express = require('express');
const axios = require('axios');
const https = require('https'); // We need the https library

module.exports = async (request, response) => {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const YOUR_INSTAFIX_URL = 'https://my-personal-instafix.onrender.com';

  if (!BOT_TOKEN) return response.status(500).send('Bot token not configured');

  try {
    const update = request.body;
    if (!update.message || !update.message.text) return response.status(200).send('OK');
    const message = update.message;
    if (message.from && message.from.is_bot) return response.status(200).send('OK');

    const text = message.text;
    const chatId = message.chat.id;
    
    const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/[\w\-\.\/]+/;
    const match = text.match(instagramRegex);
    if (!match) return response.status(200).send('OK');

    const instagramUrl = match[0];
    const fixerUrl = instagramUrl.replace('instagram.com', YOUR_INSTAFIX_URL.replace('https://', ''));

    // --- THE FINAL FIX: Create an HTTPS agent that ignores SSL errors ---
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false
    });

    // 1. Fetch from your InstaFix service using the special agent
    console.log('Fetching from my InstaFix service:', fixerUrl);
    const fixerResponse = await axios.get(fixerUrl, { httpsAgent }); // <-- Pass the agent here
    const html = fixerResponse.data;

    // 2. Extract the direct video URL
    const videoUrlMatch = html.match(/property="og:video" content="([^"]+)"/);
    if (!videoUrlMatch || !videoUrlMatch[1]) {
      throw new Error("Could not find a video URL from the InstaFix service.");
    }
    const directVideoUrl = videoUrlMatch[1];
    console.log('Found direct video URL:', directVideoUrl);

    // 3. Send the video link to Telegram (no special agent needed for this external call)
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`,
      {
        chat_id: chatId,
        video: directVideoUrl,
        reply_to_message_id: message.message_id
      }
    );
    
    response.status(200).send('OK: Processed');
  } catch (error) {
    console.error('CRITICAL ERROR:', error.message);
    const chatId = request.body.message.chat.id;
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: "Sorry, an error occurred while processing the video."
      }
    );
    response.status(200).send('OK: Error Handled');
  }
};