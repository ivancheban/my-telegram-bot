const express = require('express');
const axios = require('axios');

module.exports = async (request, response) => {
  // IMPORTANT: Make sure this URL is correct for your InstaFix service on Render
  const YOUR_INSTAFIX_URL = 'https://my-personal-instafix.onrender.com';
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!BOT_TOKEN) {
    console.error("FATAL: TELEGRAM_BOT_TOKEN is not configured in Render environment variables.");
    return response.status(500).send('Bot token not configured');
  }

  try {
    const update = request.body;

    // Standard checks to ensure we have a valid message to process
    if (!update.message || !update.message.text) {
      return response.status(200).send('OK: Not a processable message.');
    }
    const message = update.message;
    if (message.from && message.from.is_bot) {
      return response.status(200).send('OK: Ignored message from a bot.');
    }

    const text = message.text;
    const chatId = message.chat.id;
    
    // Find an Instagram link in the message
    const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/[\w\-\.\/]+/;
    const match = text.match(instagramRegex);

    if (!match) {
      return response.status(200).send('OK: No Instagram URL found in the message.');
    }

    const instagramUrl = match[0];
    
    // Construct the URL to call your own self-hosted InstaFix service
    const fixerUrl = instagramUrl.replace('instagram.com', YOUR_INSTAFIX_URL.replace('https://', ''));

    // Step 1: Your bot calls your InstaFix service
    console.log('Fetching from my InstaFix service:', fixerUrl);
    const fixerResponse = await axios.get(fixerUrl);
    const html = fixerResponse.data;

    // Step 2: Your bot scrapes the response to find the direct video link
    const videoUrlMatch = html.match(/property="og:video" content="([^"]+)"/);
    if (!videoUrlMatch || !videoUrlMatch[1]) {
      throw new Error("Could not find a playable video URL from the InstaFix service.");
    }
    const directVideoUrl = videoUrlMatch[1];
    console.log('Found direct video URL:', directVideoUrl);

    // Step 3: Your bot sends the final, direct video URL to Telegram
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`,
      {
        chat_id: chatId,
        video: directVideoUrl,
        reply_to_message_id: message.message_id
      }
    );
    
    // Tell Render the process was successful
    response.status(200).send('OK: Processed');

  } catch (error) {
    console.error('CRITICAL ERROR:', error.message);
    const chatId = request.body.message.chat.id;
    // Notify the user in chat that something went wrong
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: "Sorry, an error occurred while trying to process that video."
      }
    );
    // Respond to prevent Telegram from retrying
    response.status(200).send('OK: Error Handled');
  }
};