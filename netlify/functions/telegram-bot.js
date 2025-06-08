const fetch = require('node-fetch');
const FormData = require('form-data');
// Import the new FFmpeg libraries
const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error("FATAL: Bot token not configured.");
    return { statusCode: 200, body: 'OK' };
  }

  try {
    const update = JSON.parse(event.body);
    if (!update.message || !update.message.text) {
      return { statusCode: 200, body: 'OK: Not a text message' };
    }

    const message = update.message;
    if (message.from && message.from.is_bot) {
      return { statusCode: 200, body: 'OK: Ignored bot message' };
    }

    const text = message.text;
    const chatId = message.chat.id;
    const urlRegex = /https?/\/\/[^\s]+/g;
    const urls = text.match(urlRegex);

    if (!urls) {
      return { statusCode: 200, body: 'OK: No URLs found' };
    }

    let fixerUrl = '';
    
    for (const url of urls) {
      if (url.includes('instagram.com')) {
        const cleanUrl = url.split('?')[0];
        fixerUrl = cleanUrl.replace('instagram.com', 'ddinstagram.com');
        break;
      }
    }

    if (fixerUrl) {
      console.log('Step 1: Downloading video from', fixerUrl);
      const videoResponse = await fetch(fixerUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video. Status: ${videoResponse.statusText}`);
      }
      const videoBuffer = await videoResponse.buffer();
      console.log('Step 2: Download complete. Initial size:', videoBuffer.length);

      // --- Step 3: FIX THE VIDEO METADATA WITH FFMPEG ---
      console.log('Step 3: Initializing FFmpeg to fix video metadata...');
      const ffmpeg = createFFmpeg({ log: true });
      await ffmpeg.load();
      
      console.log('Step 3a: Writing video to FFmpeg memory...');
      ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoBuffer));

      console.log('Step 3b: Running FFmpeg command to fix moov atom...');
      // This command copies the video without re-encoding and moves the metadata to the front.
      await ffmpeg.run('-i', 'input.mp4', '-c', 'copy', '-movflags', 'faststart', 'output.mp4');

      console.log('Step 3c: Reading fixed video from FFmpeg memory...');
      const fixedVideoData = ffmpeg.FS('readFile', 'output.mp4');
      console.log('Step 3d: FFmpeg processing complete. Fixed size:', fixedVideoData.length);
      
      await ffmpeg.exit(); // Clean up FFmpeg instance

      // --- Step 4: UPLOAD THE FIXED VIDEO ---
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('reply_to_message_id', message.message_id);
      form.append('video', fixedVideoData, { filename: 'instagram_video.mp4' });

      console.log('Step 4: Uploading FIXED video to Telegram...');
      const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`;
      const uploadResponse = await fetch(telegramApiUrl, {
        method: 'POST',
        body: form
      });

      const telegramResult = await uploadResponse.json();
      console.log('Step 5: Upload complete. Final Telegram Response:', JSON.stringify(telegramResult));
    }

    return { statusCode: 200, body: 'OK: Processed' };

  } catch (error) {
    console.error('CRITICAL ERROR in execution:', error);
    const chatId = JSON.parse(event.body).message.chat.id;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: "Sorry, a critical error occurred while processing the video." })
    });
    return { statusCode: 200, body: 'OK: Error handled' };
  }
};