module.exports = {
    proxy: {
        timeout: 30000,
        maxRetries: 3,
        services: [
            {
                name: 'rapidsave',
                url: 'https://rapidsave.com/api/download',
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            },
            {
                name: 'ddinstagram',
                url: (url) => url.replace('instagram.com', 'ddinstagram.com'),
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
                    'Accept': 'text/html,application/xhtml+xml,video/*'
                }
            }
        ]
    }
};