# yt-dlp Microservice

A production-ready Node.js microservice for video processing using yt-dlp. This service provides REST API endpoints to extract video metadata and download links from various platforms including YouTube, TikTok, Instagram, CapCut, and more.

## Features

- 🎥 **Video Metadata Extraction** - Get title, thumbnail, duration, and other metadata
- 🔗 **Download Links** - Retrieve direct download URLs for different video qualities
- 🔐 **API Key Authentication** - Secure access with API key validation
- 🛡️ **Rate Limiting** - Built-in protection against abuse (100 requests per 15 minutes)
- 📝 **Comprehensive Logging** - Winston-based logging with file and console output
- 🐳 **Docker Support** - Ready for containerized deployment
- 🚀 **Railway Compatible** - Optimized for Railway deployment
- ⚡ **CORS Support** - Cross-origin requests enabled
- 🔒 **Security Headers** - Helmet.js for enhanced security

## Supported Platforms

- YouTube (youtube.com, youtu.be)
- TikTok (tiktok.com)
- Instagram (instagram.com)
- CapCut (capcut.com)
- Twitter/X (twitter.com, x.com)
- Facebook (facebook.com)
- And many more supported by yt-dlp

## Quick Start

### Prerequisites

- Node.js 18+ 
- yt-dlp installed on your system
- FFmpeg (recommended for better format support)

### Local Development

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd yt-dlp-microservice
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Install yt-dlp:**
```bash
# On macOS/Linux
pip3 install yt-dlp

# On Windows
pip install yt-dlp
```

4. **Start the development server:**
```bash
npm run dev
```

The service will be available at `http://localhost:3000`

### Docker Deployment

1. **Build the Docker image:**
```bash
docker build -t yt-dlp-microservice .
```

2. **Run the container:**
```bash
docker run -p 3000:3000 \
  -e API_KEY=your-secret-api-key \
  -e PORT=3000 \
  yt-dlp-microservice
```

### Railway Deployment

1. **Connect your GitHub repository to Railway**
2. **Set environment variables in Railway dashboard:**
   - `API_KEY`: Your secure API key
   - `PORT`: Will be automatically set by Railway
   - `NODE_ENV`: production

3. **Deploy:** Railway will automatically build and deploy using the Dockerfile

## API Documentation

### Authentication

All API endpoints (except `/health` and `/api/docs`) require authentication using an API key.

**Methods:**
- Header: `X-API-Key: your-api-key`
- Query parameter: `?apiKey=your-api-key`

### Endpoints

#### Health Check
```http
GET /health
```

Returns service health status. No authentication required.

**Response:**
```json
{
  "success": true,
  "message": "Service is healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600
}
```

#### Get Video Information
```http
POST /api/video-info
Content-Type: application/json
X-API-Key: your-api-key

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Rick Astley - Never Gonna Give You Up",
    "description": "The official video for...",
    "duration": 212,
    "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "uploader": "Rick Astley",
    "upload_date": "20091025",
    "view_count": 1000000000,
    "like_count": 10000000,
    "webpage_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "extractor": "youtube",
    "format_count": 25
  }
}
```

#### Get Download Links
```http
POST /api/download-links
Content-Type: application/json
X-API-Key: your-api-key

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Rick Astley - Never Gonna Give You Up",
    "webpage_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "formats": {
      "video_audio": [
        {
          "format_id": "18",
          "url": "https://direct-download-url...",
          "ext": "mp4",
          "quality": "360p",
          "filesize": 15728640,
          "vcodec": "avc1.42001E",
          "acodec": "mp4a.40.2",
          "width": 640,
          "height": 360,
          "fps": 30,
          "tbr": 500
        }
      ],
      "audio_only": [
        {
          "format_id": "140",
          "url": "https://direct-audio-url...",
          "ext": "m4a",
          "quality": "medium",
          "filesize": 3145728,
          "vcodec": "none",
          "acodec": "mp4a.40.2"
        }
      ],
      "video_only": []
    },
    "total_formats": 25,
    "best_video": { /* best quality video+audio format */ },
    "best_audio": { /* best quality audio-only format */ }
  }
}
```

#### API Documentation
```http
GET /api/docs
```

Returns complete API documentation. No authentication required.

### Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "details": [] // Optional validation details
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing API key)
- `403` - Forbidden (invalid API key)
- `404` - Not Found (endpoint or video not found)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `API_KEY` | Authentication key | `your-secret-api-key` | Yes |
| `NODE_ENV` | Environment | `development` | No |
| `LOG_LEVEL` | Logging level | `info` | No |

### Rate Limiting

- **Window:** 15 minutes
- **Max Requests:** 100 per IP
- **Headers:** Standard rate limit headers included

### Security Features

- **Helmet.js:** Security headers
- **CORS:** Cross-origin resource sharing
- **Input Validation:** URL and request validation
- **API Key Authentication:** Secure endpoint access
- **Error Sanitization:** No sensitive data in error messages
- **Non-root Docker User:** Container security

## Logging

The service uses Winston for comprehensive logging:

- **Console:** Development-friendly output
- **Files:** 
  - `logs/combined.log` - All logs
  - `logs/error.log` - Error logs only
- **Format:** JSON with timestamps
- **Levels:** error, warn, info, debug

## Performance Considerations

- **Timeouts:** 30s for video info, 45s for download links
- **Buffer Limits:** 10MB for yt-dlp output
- **Format Limits:** Max 10 video formats, 5 audio formats returned
- **Memory:** Optimized for Railway's memory constraints

## Troubleshooting

### Common Issues

1. **"yt-dlp not found"**
   - Ensure yt-dlp is installed and in PATH
   - For Docker: Rebuild the image

2. **"Video unavailable"**
   - Check if the video is public and accessible
   - Some platforms may block automated access

3. **Rate limiting**
   - Wait for the rate limit window to reset
   - Consider implementing request queuing for high traffic

4. **Memory issues**
   - Large videos may require more memory
   - Consider implementing streaming for large responses

### Debug Mode

Set `LOG_LEVEL=debug` to enable verbose logging:

```bash
LOG_LEVEL=debug npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs for error details
3. Open an issue with:
   - Error message
   - Steps to reproduce
   - Environment details

---

**Note:** This service is designed for legitimate use cases. Please respect the terms of service of the platforms you're accessing and ensure you have the right to download the content.