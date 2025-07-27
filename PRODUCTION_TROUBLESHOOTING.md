# Production Deployment Troubleshooting Guide

## Issue: "Video is unavailable, private, or has been removed" Error on Render

### Problem Description
Your yt-dlp microservice works perfectly on your local development environment but fails with `VIDEO_UNAVAILABLE` errors when deployed to Render.com. This is a **common issue** when deploying yt-dlp applications to cloud platforms.

### Root Causes

Based on research and common deployment issues, here are the main reasons why this happens:

#### 1. **IP-Based Restrictions** 🚫
- YouTube actively blocks requests from known cloud provider IP ranges
- Render.com servers are easily identified as cloud infrastructure
- Your local IP appears as a regular residential connection

#### 2. **Geographic Restrictions** 🌍
- Render servers may be located in regions where certain videos are blocked
- Content licensing varies by geographic location
- Some videos are only available in specific countries

#### 3. **Enhanced Bot Detection** 🤖
- YouTube's anti-bot measures are more aggressive for cloud IPs
- Multiple requests from the same server IP trigger rate limiting
- Cloud platforms are flagged as potential bot sources

#### 4. **Rate Limiting** ⏱️
- Cloud servers face stricter rate limits than residential IPs
- Shared infrastructure means multiple users may hit the same limits
- YouTube implements more aggressive throttling for data center IPs

#### 5. **Authentication Requirements** 🔐
- Some videos require sign-in verification on cloud platforms
- Age-restricted content needs additional authentication
- Private or unlisted videos are not accessible without proper credentials

### Solutions and Workarounds

#### Immediate Testing Solutions ✅

1. **Try Different Video URLs**
   ```
   # Test with these known working videos:
   https://www.youtube.com/watch?v=jNQXAC9IVRw  # Me at the zoo (first YouTube video)
   https://www.youtube.com/watch?v=9bZkp7q19f0  # PSY - GANGNAM STYLE
   https://www.youtube.com/watch?v=kJQP7kiw5Fk  # Despacito
   ```

2. **Avoid Problematic Content**
   - Skip age-restricted videos
   - Avoid region-locked content
   - Don't use private/unlisted videos
   - Test with popular, widely available content

3. **Use Shorter Videos**
   - Videos under 10 minutes often work better
   - Less likely to trigger timeout issues
   - Faster processing reduces server load

#### Technical Solutions 🔧

1. **Add User-Agent Rotation**
   ```javascript
   // In your yt-dlp command, add:
   --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
   ```

2. **Implement Retry Logic**
   ```javascript
   // Add exponential backoff for failed requests
   const maxRetries = 3;
   const baseDelay = 1000;
   ```

3. **Use Proxy Services** (Advanced)
   - Consider residential proxy services
   - Rotate IP addresses for requests
   - Use VPN endpoints in different regions

4. **Add Request Headers**
   ```javascript
   // Mimic browser requests more closely
   --add-header "Accept-Language:en-US,en;q=0.9"
   --add-header "Accept-Encoding:gzip, deflate, br"
   ```

#### Environment-Specific Configuration 🏗️

1. **Update Dockerfile**
   ```dockerfile
   # Add additional yt-dlp configuration
   RUN pip3 install --no-cache-dir --break-system-packages yt-dlp[default]
   
   # Set environment variables for better compatibility
   ENV PYTHONIOENCODING=utf-8
   ENV YT_DLP_CACHE_DIR=/tmp/yt-dlp-cache
   ```

2. **Configure yt-dlp Options**
   ```javascript
   // In your ytdlp.js utility, add these options:
   const ytdlpOptions = [
     '--no-check-certificate',
     '--prefer-free-formats',
     '--no-warnings',
     '--extract-flat',
     '--socket-timeout', '30'
   ];
   ```

### Testing Your Deployment

#### 1. **Health Check First**
```bash
curl https://mainapi-qbiw.onrender.com/health
```

#### 2. **Test with Known Working Video**
```bash
curl -X POST 'https://mainapi-qbiw.onrender.com/api/video-info' \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-api-key' \
  -d '{"url": "https://www.youtube.com/watch?v=jNQXAC9IVRw"}'
```

#### 3. **Monitor Logs**
- Check Render deployment logs
- Look for specific yt-dlp error messages
- Monitor response times and timeouts

### Expected Limitations

#### What Will Likely NOT Work in Production:
- Age-restricted videos
- Private or unlisted videos
- Region-locked content
- Very long videos (>1 hour)
- Live streams
- Recently uploaded videos (may need time to process)

#### What SHOULD Work in Production:
- Popular, public YouTube videos
- Short to medium length content (under 30 minutes)
- Widely available, non-restricted videos
- Educational or creative commons content

### Alternative Approaches

#### 1. **Client-Side Processing**
- Move yt-dlp processing to client-side
- Use browser extensions or desktop applications
- Avoid cloud platform restrictions entirely

#### 2. **Hybrid Approach**
- Use cloud API for metadata only
- Process downloads on user's machine
- Combine server and client capabilities

#### 3. **Different Hosting Platform**
- Try other cloud providers (Heroku, Railway, Vercel)
- Use VPS with residential IP
- Consider dedicated server hosting

### Monitoring and Debugging

#### Add Enhanced Logging
```javascript
// In your error handling:
logger.error('Video extraction failed', {
  url: url.substring(0, 50),
  error: error.message,
  stderr: error.stderr,
  platform: 'render',
  timestamp: new Date().toISOString()
});
```

#### Track Success Rates
```javascript
// Monitor which types of videos work
const successMetrics = {
  totalRequests: 0,
  successfulExtractions: 0,
  failuresByCode: {}
};
```

### Conclusion

The "Video unavailable" error on Render is primarily due to YouTube's restrictions on cloud platform IPs. This is a **known limitation** of deploying yt-dlp to cloud services, not a bug in your code.

**Your options:**
1. **Accept the limitation** and test with videos that work in production
2. **Implement workarounds** like proxy services or user-agent rotation
3. **Consider alternative architectures** that avoid cloud platform restrictions

Remember: The same video that works locally may fail in production due to these platform-level restrictions. This is expected behavior when using yt-dlp on cloud infrastructure.

### Useful Resources

- [yt-dlp GitHub Issues](https://github.com/yt-dlp/yt-dlp/issues) - Search for "cloud" or "production"
- [Render Community Forum](https://community.render.com/) - yt-dlp deployment discussions
- [YouTube API Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service) - Official guidelines

---

**Last Updated:** January 2025  
**Status:** This is an ongoing limitation of cloud-based yt-dlp deployments