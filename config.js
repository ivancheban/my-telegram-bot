module.exports = {
    proxy: {
        timeout: 30000,
        maxRetries: 3,
        services: [
            {
                name: 'instagram-direct',
                url: (url) => url.replace('instagram.com', 'ddinstagram.com'),
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
                    'Accept': 'text/html,application/xhtml+xml,video/*',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                parseVideo: true,
                extractPatterns: [
                    /video_url["':]+([^"']+)/i,
                    /property="og:video"\s+content="([^"]+)"/i,
                    /source\s+src=["']([^"']+)/i
                ]
            },
            {
                name: 'instagram-backup',
                url: (url) => url.replace('instagram.com', 'instagram.cdnist.com'),
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,video/*'
                },
                parseVideo: true,
                extractPatterns: [
                    /video_url["':]+([^"']+)/i,
                    /property="og:video"\s+content="([^"]+)"/i
                ]
            },
            {
                name: 'insta-download',
                url: 'https://insta-dl-worker.vercel.app/api/download',
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        ]
    }
};