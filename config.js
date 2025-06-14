// config.js
module.exports = {
    proxy: {
        timeout: 45000, // Increased timeout for potentially slow APIs
        maxRetries: 2,   // 2 retries is plenty
        services: [
            {
                // This is the primary, most reliable service.
                name: 'cobalt-api',
                url: 'https://co.wuk.sh/api/json', // The correct API endpoint
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                // This service returns JSON, so parseVideo should be false.
                parseVideo: false 
            },
            {
                // Fallback service: This one tries to get the direct video from a ddinstagram page.
                name: 'ddinstagram-scrape',
                url: (url) => url.replace('instagram.com', 'ddinstagram.com'),
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                    'Accept': 'text/html,application/xhtml+xml'
                },
                // This service returns HTML, so we need to parse it to find the video URL.
                parseVideo: true,
                extractPatterns: [
                    /property="og:video" content="([^"]+)"/, // The most reliable pattern
                    /property="og:video:secure_url" content="([^"]+)"/
                ]
            }
        ]
    }
};