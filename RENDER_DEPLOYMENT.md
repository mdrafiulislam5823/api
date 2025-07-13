# Render Deployment Guide

This guide will help you successfully deploy the yt-dlp microservice on Render.

## Prerequisites

1. A Render account (free tier available)
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. Docker enabled in your Render service

## Deployment Steps

### Method 1: Using render.yaml (Recommended)

1. **Push your code** to your Git repository including the `render.yaml` file
2. **Connect to Render**:
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" → "Blueprint"
   - Connect your repository
   - Render will automatically detect the `render.yaml` file

3. **Configure Environment Variables** (if not using render.yaml auto-generation):
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render will override this automatically)
   - `API_KEY`: Generate a secure random string

### Method 2: Manual Web Service Creation

1. **Create New Web Service**:
   - Go to Render Dashboard
   - Click "New" → "Web Service"
   - Connect your repository

2. **Configure Service**:
   - **Name**: `yt-dlp-microservice`
   - **Environment**: `Docker`
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Dockerfile Path**: `./Dockerfile`

3. **Environment Variables**:
   ```
   NODE_ENV=production
   API_KEY=your-secure-api-key-here
   ```

4. **Advanced Settings**:
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: `Yes`

## Important Configuration Changes Made

### 1. Port Configuration
- Changed default port from `3000` to `10000`
- Render automatically sets the `PORT` environment variable
- Updated Dockerfile health check to use dynamic port

### 2. Docker Configuration
- Updated `EXPOSE` directive to use `$PORT`
- Modified health check to use `${PORT:-10000}`

### 3. Environment Variables
- Updated `.env.example` with production-ready defaults
- Added `NODE_ENV=production`

## Testing Your Deployment

Once deployed, test these endpoints:

1. **Health Check**: `https://your-app.onrender.com/health`
2. **API Status**: `https://your-app.onrender.com/api/status`
3. **API Documentation**: `https://your-app.onrender.com/api/docs`

## Common Issues and Solutions

### 1. "Endpoint not found" Error
- **Cause**: Deployment failed or service not started
- **Solution**: Check Render logs for build/runtime errors

### 2. Build Timeout
- **Cause**: Docker build takes too long
- **Solution**: Optimize Dockerfile, use smaller base images

### 3. Health Check Failures
- **Cause**: App not responding on correct port
- **Solution**: Ensure app listens on `process.env.PORT`

### 4. yt-dlp Not Found
- **Cause**: System dependencies not installed
- **Solution**: Dockerfile already includes yt-dlp installation

## Monitoring and Logs

- **View Logs**: Render Dashboard → Your Service → Logs
- **Metrics**: Available in the Render dashboard
- **Health Monitoring**: Automatic via `/health` endpoint

## Security Best Practices

1. **API Key**: Use a strong, randomly generated API key
2. **Environment Variables**: Never commit secrets to your repository
3. **HTTPS**: Render provides free SSL certificates
4. **Rate Limiting**: Consider enabling rate limiting for production

## Scaling

- **Free Tier**: Limited resources, may spin down after inactivity
- **Paid Tiers**: Better performance, always-on, horizontal scaling
- **Auto-scaling**: Configure based on CPU/memory usage

## Support

If you encounter issues:
1. Check Render's [documentation](https://render.com/docs)
2. Review build and runtime logs
3. Verify all environment variables are set
4. Test locally with Docker first

## Local Testing with Docker

Before deploying, test locally:

```bash
# Build the image
docker build -t yt-dlp-microservice .

# Run with environment variables
docker run -p 10000:10000 -e PORT=10000 -e API_KEY=test-key yt-dlp-microservice

# Test the endpoints
curl http://localhost:10000/health
curl http://localhost:10000/api/status
```

This ensures your Docker configuration works before deploying to Render.