const express = require('express');
const { authenticateApiKey } = require('../middleware/auth');
const { validateVideoUrlOnly } = require('../middleware/validation');
const { getVideoInfo, getDownloadFormats } = require('../utils/ytdlp');
const { createModuleLogger, logPerformance, logError } = require('../utils/logger');

const router = express.Router();
const logger = createModuleLogger('video-routes');

/**
 * @route POST /api/video-info
 * @desc Extract video metadata from URL
 * @access Private (API Key required)
 */
router.post('/video-info', authenticateApiKey, validateVideoUrlOnly, async (req, res) => {
  const startTime = Date.now();
  const { url } = req.body;
  const requestId = req.requestId;
  
  try {
    logger.info('Processing video info request', {
      requestId,
      url: url.substring(0, 50) + '...',
      platform: req.platform,
      ip: req.ip
    });
    
    // Extract video information
    const videoInfo = await getVideoInfo(url);
    
    const duration = Date.now() - startTime;
    logPerformance('video-info-extraction', duration, {
      requestId,
      platform: req.platform,
      title: videoInfo.title
    });
    
    // Prepare response
    const response = {
      success: true,
      data: {
        ...videoInfo,
        extracted_at: new Date().toISOString(),
        processing_time: `${duration}ms`
      },
      meta: {
        request_id: requestId,
        platform: req.platform,
        api_version: '1.0.0'
      }
    };
    
    logger.info('Video info extracted successfully', {
      requestId,
      title: videoInfo.title,
      duration: `${duration}ms`,
      platform: req.platform
    });
    
    res.status(200).json(response);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logError(error, {
      requestId,
      url: url.substring(0, 50) + '...',
      platform: req.platform,
      duration: `${duration}ms`,
      operation: 'video-info-extraction'
    });
    
    // Determine appropriate status code based on error type
    let statusCode = 500;
    let errorMessage = 'Failed to extract video information';
    
    if (error.code === 'VIDEO_UNAVAILABLE') {
      statusCode = 404;
      errorMessage = error.message;
    } else if (error.code === 'UNSUPPORTED_URL') {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.code === 'TIMEOUT_ERROR') {
      statusCode = 408;
      errorMessage = error.message;
    } else if (error.code === 'RATE_LIMITED') {
      statusCode = 429;
      errorMessage = error.message;
    } else if (error.code === 'AUTH_REQUIRED') {
      statusCode = 403;
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      code: error.code || 'EXTRACTION_ERROR',
      meta: {
        request_id: requestId,
        platform: req.platform,
        processing_time: `${duration}ms`,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route POST /api/download-links
 * @desc Get direct download URLs for different video qualities
 * @access Private (API Key required)
 */
router.post('/download-links', authenticateApiKey, validateVideoUrlOnly, async (req, res) => {
  const startTime = Date.now();
  const { url } = req.body;
  const requestId = req.requestId;
  
  try {
    logger.info('Processing download links request', {
      requestId,
      url: url.substring(0, 50) + '...',
      platform: req.platform,
      ip: req.ip
    });
    
    // Get download formats
    const downloadInfo = await getDownloadFormats(url);
    
    const duration = Date.now() - startTime;
    logPerformance('download-links-extraction', duration, {
      requestId,
      platform: req.platform,
      title: downloadInfo.title,
      formatCount: downloadInfo.total_formats
    });
    
    
    // Check for other cases where no formats are available
    if (downloadInfo.total_formats === 0) {
      return res.status(404).json({
        success: false,
        error: 'No downloadable formats found',
        message: 'This video does not have any downloadable formats available. This could be due to platform restrictions, geographic limitations, or the content being unavailable.',
        code: 'NO_FORMATS_AVAILABLE',
        data: {
          title: downloadInfo.title,
          webpage_url: downloadInfo.webpage_url,
          platform: req.platform
        },
        meta: {
          request_id: requestId,
          platform: req.platform,
          api_version: '1.0.0',
          processing_time: `${duration}ms`
        }
      });
    }
    
    // Prepare response with additional metadata
    const responseData = {
      ...downloadInfo,
      extracted_at: new Date().toISOString(),
      processing_time: `${duration}ms`,
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // URLs expire in 6 hours
      usage_notes: {
        expiration: 'Download URLs typically expire within 6 hours',
        rate_limits: 'Respect the platform\'s rate limits when downloading',
        quality_recommendation: 'Use recommended formats for best compatibility'
      }
    };
    
    // Add thumbnail URL if available (for CapCut and other platforms)
    if (downloadInfo.thumbnail) {
      responseData.thumbnail_url = downloadInfo.thumbnail;
    }
    
    const response = {
      success: true,
      data: responseData,
      meta: {
        request_id: requestId,
        platform: req.platform,
        api_version: '1.0.0',
        format_categories: {
          video_audio: downloadInfo.formats.video_audio.length,
          audio_only: downloadInfo.formats.audio_only.length,
          video_only: downloadInfo.formats.video_only.length
        }
      }
    };
    
    logger.info('Download links extracted successfully', {
      requestId,
      title: downloadInfo.title,
      duration: `${duration}ms`,
      platform: req.platform,
      formatCount: downloadInfo.total_formats
    });
    
    res.status(200).json(response);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logError(error, {
      requestId,
      url: url.substring(0, 50) + '...',
      platform: req.platform,
      duration: `${duration}ms`,
      operation: 'download-links-extraction'
    });
    
    // Determine appropriate status code based on error type
    let statusCode = 500;
    let errorMessage = 'Failed to extract download links';
    
    if (error.code === 'VIDEO_UNAVAILABLE') {
      statusCode = 404;
      errorMessage = error.message;
    } else if (error.code === 'NO_FORMATS') {
      statusCode = 404;
      errorMessage = error.message;
    } else if (error.code === 'UNSUPPORTED_URL') {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.code === 'TIMEOUT_ERROR') {
      statusCode = 408;
      errorMessage = error.message;
    } else if (error.code === 'RATE_LIMITED') {
      statusCode = 429;
      errorMessage = error.message;
    } else if (error.code === 'AUTH_REQUIRED') {
      statusCode = 403;
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      code: error.code || 'EXTRACTION_ERROR',
      meta: {
        request_id: requestId,
        platform: req.platform,
        processing_time: `${duration}ms`,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route POST /api/quick-info
 * @desc Get basic video info quickly (lighter version)
 * @access Private (API Key required)
 */
router.post('/quick-info', authenticateApiKey, validateVideoUrlOnly, async (req, res) => {
  const startTime = Date.now();
  const { url } = req.body;
  const requestId = req.requestId;
  
  try {
    logger.info('Processing quick info request', {
      requestId,
      url: url.substring(0, 50) + '...',
      platform: req.platform,
      ip: req.ip
    });
    
    // Get basic video information (faster)
    const videoInfo = await getVideoInfo(url);
    
    const duration = Date.now() - startTime;
    logPerformance('quick-info-extraction', duration, {
      requestId,
      platform: req.platform,
      title: videoInfo.title
    });
    
    // Return only essential information for faster response
    const response = {
      success: true,
      data: {
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        duration: videoInfo.duration,
        uploader: videoInfo.uploader,
        webpage_url: videoInfo.webpage_url,
        extractor: videoInfo.extractor,
        processing_time: `${duration}ms`
      },
      meta: {
        request_id: requestId,
        platform: req.platform,
        api_version: '1.0.0',
        response_type: 'quick_info'
      }
    };
    
    logger.info('Quick info extracted successfully', {
      requestId,
      title: videoInfo.title,
      duration: `${duration}ms`,
      platform: req.platform
    });
    
    res.status(200).json(response);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logError(error, {
      requestId,
      url: url.substring(0, 50) + '...',
      platform: req.platform,
      duration: `${duration}ms`,
      operation: 'quick-info-extraction'
    });
    
    let statusCode = 500;
    let errorMessage = 'Failed to extract quick video information';
    
    if (error.code === 'VIDEO_UNAVAILABLE') {
      statusCode = 404;
      errorMessage = error.message;
    } else if (error.code === 'TIMEOUT_ERROR') {
      statusCode = 408;
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      code: error.code || 'QUICK_INFO_ERROR',
      meta: {
        request_id: requestId,
        platform: req.platform,
        processing_time: `${duration}ms`,
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;