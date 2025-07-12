const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { checkYtDlpAvailability, getYtDlpVersion } = require('../utils/ytdlp');
const { SUPPORTED_PLATFORMS } = require('../middleware/validation');
const { createModuleLogger } = require('../utils/logger');

const router = express.Router();
const logger = createModuleLogger('system-routes');

/**
 * @route GET /health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      node_version: process.version,
      platform: process.platform,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100
      },
      response_time: `${Date.now() - startTime}ms`
    };
    
    // Check yt-dlp availability
    try {
      const ytdlpAvailable = await checkYtDlpAvailability();
      health.dependencies = {
        ytdlp: {
          status: ytdlpAvailable ? 'available' : 'unavailable',
          version: ytdlpAvailable ? await getYtDlpVersion() : 'unknown'
        }
      };
    } catch (error) {
      health.dependencies = {
        ytdlp: {
          status: 'error',
          error: error.message
        }
      };
      health.status = 'degraded';
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    logger.info('Health check completed', {
      status: health.status,
      responseTime: health.response_time,
      ytdlpStatus: health.dependencies?.ytdlp?.status
    });
    
    res.status(statusCode).json({
      success: true,
      data: health
    });
    
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        response_time: `${Date.now() - startTime}ms`
      }
    });
  }
});

/**
 * @route GET /api/docs
 * @desc API documentation endpoint
 * @access Public
 */
router.get('/api/docs', (req, res) => {
  const documentation = {
    title: 'yt-dlp Microservice API',
    version: '1.0.0',
    description: 'A production-ready microservice for extracting video metadata and download links using yt-dlp',
    base_url: `${req.protocol}://${req.get('host')}`,
    
    authentication: {
      type: 'API Key',
      methods: [
        {
          type: 'header',
          name: 'X-API-Key',
          example: 'X-API-Key: your-api-key-here'
        },
        {
          type: 'query_parameter',
          name: 'apiKey',
          example: '?apiKey=your-api-key-here'
        }
      ],
      note: 'API key is required for all endpoints except /health and /api/docs'
    },
    
    endpoints: {
      system: {
        'GET /health': {
          description: 'Health check endpoint with system status',
          authentication: false,
          response_example: {
            success: true,
            data: {
              status: 'healthy',
              timestamp: '2024-01-01T00:00:00.000Z',
              uptime: 3600,
              dependencies: {
                ytdlp: {
                  status: 'available',
                  version: '2024.01.01'
                }
              }
            }
          }
        },
        'GET /api/docs': {
          description: 'API documentation (this endpoint)',
          authentication: false
        },
        'GET /api/status': {
          description: 'Detailed system status and statistics',
          authentication: 'optional'
        }
      },
      
      video: {
        'POST /api/video-info': {
          description: 'Extract comprehensive video metadata',
          authentication: true,
          body: {
            url: 'string (required) - Video URL from supported platforms'
          },
          response_example: {
            success: true,
            data: {
              title: 'Video Title',
              description: 'Video description...',
              duration: 212,
              thumbnail: 'https://example.com/thumb.jpg',
              uploader: 'Channel Name',
              view_count: 1000000,
              webpage_url: 'https://platform.com/video'
            }
          }
        },
        
        'POST /api/download-links': {
          description: 'Get direct download URLs for different video qualities',
          authentication: true,
          body: {
            url: 'string (required) - Video URL from supported platforms'
          },
          response_example: {
            success: true,
            data: {
              title: 'Video Title',
              formats: {
                video_audio: [],
                audio_only: [],
                video_only: []
              },
              best_video: {},
              best_audio: {}
            }
          }
        },
        
        'POST /api/quick-info': {
          description: 'Get basic video information quickly (faster response)',
          authentication: true,
          body: {
            url: 'string (required) - Video URL from supported platforms'
          }
        }
      }
    },
    
    supported_platforms: Object.keys(SUPPORTED_PLATFORMS).map(platform => ({
      name: platform,
      domains: SUPPORTED_PLATFORMS[platform]
    })),
    
    rate_limits: {
      requests_per_window: 100,
      window_duration: '15 minutes',
      headers: {
        'X-RateLimit-Limit': 'Maximum requests per window',
        'X-RateLimit-Remaining': 'Remaining requests in current window',
        'X-RateLimit-Reset': 'Time when the rate limit resets'
      }
    },
    
    error_codes: {
      'MISSING_API_KEY': 'API key not provided',
      'INVALID_API_KEY': 'Invalid API key',
      'VALIDATION_ERROR': 'Request validation failed',
      'VIDEO_UNAVAILABLE': 'Video is unavailable or private',
      'UNSUPPORTED_URL': 'URL platform not supported',
      'TIMEOUT_ERROR': 'Request timed out',
      'RATE_LIMITED': 'Rate limited by video platform',
      'NO_FORMATS': 'No downloadable formats found',
      'YTDLP_NOT_FOUND': 'yt-dlp not installed',
      'EXTRACTION_ERROR': 'General extraction error'
    },
    
    response_format: {
      success_response: {
        success: true,
        data: '{ ... response data ... }',
        meta: '{ ... metadata ... }'
      },
      error_response: {
        success: false,
        error: 'Error message',
        code: 'ERROR_CODE',
        meta: '{ ... metadata ... }'
      }
    },
    
    examples: {
      curl_video_info: `curl -X POST '${req.protocol}://${req.get('host')}/api/video-info' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: your-api-key' \\
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'`,
      
      curl_download_links: `curl -X POST '${req.protocol}://${req.get('host')}/api/download-links' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: your-api-key' \\
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'`
    },
    
    notes: {
      url_expiration: 'Download URLs typically expire within 6 hours',
      rate_limiting: 'Respect platform rate limits when downloading content',
      legal_notice: 'Ensure you have the right to download the content',
      performance: 'Use /api/quick-info for faster responses when full metadata is not needed'
    }
  };
  
  logger.info('API documentation accessed', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(200).json({
    success: true,
    documentation
  });
});

/**
 * @route GET /api/status
 * @desc Detailed system status and statistics
 * @access Public (enhanced with API key)
 */
router.get('/api/status', optionalAuth, async (req, res) => {
  try {
    const status = {
      service: {
        name: 'yt-dlp-microservice',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: {
          seconds: process.uptime(),
          human: formatUptime(process.uptime())
        },
        started_at: new Date(Date.now() - process.uptime() * 1000).toISOString()
      },
      
      system: {
        node_version: process.version,
        platform: process.platform,
        architecture: process.arch,
        memory: {
          heap_used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
          heap_total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
          external: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100,
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100
        },
        cpu: {
          usage: process.cpuUsage()
        }
      },
      
      dependencies: {},
      
      features: {
        supported_platforms: Object.keys(SUPPORTED_PLATFORMS).length,
        rate_limiting: true,
        authentication: true,
        logging: true,
        health_checks: true
      }
    };
    
    // Check yt-dlp status
    try {
      const ytdlpAvailable = await checkYtDlpAvailability();
      status.dependencies.ytdlp = {
        status: ytdlpAvailable ? 'available' : 'unavailable',
        version: ytdlpAvailable ? await getYtDlpVersion() : null,
        last_checked: new Date().toISOString()
      };
    } catch (error) {
      status.dependencies.ytdlp = {
        status: 'error',
        error: error.message,
        last_checked: new Date().toISOString()
      };
    }
    
    // Add enhanced information for authenticated requests
    if (req.authenticated) {
      status.enhanced = {
        process_id: process.pid,
        working_directory: process.cwd(),
        environment_variables: {
          NODE_ENV: process.env.NODE_ENV,
          PORT: process.env.PORT,
          LOG_LEVEL: process.env.LOG_LEVEL
        }
      };
    }
    
    logger.info('System status accessed', {
      ip: req.ip,
      authenticated: req.authenticated || false
    });
    
    res.status(200).json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('System status check failed', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/platforms
 * @desc List all supported platforms and their domains
 * @access Public
 */
router.get('/api/platforms', (req, res) => {
  const platforms = Object.entries(SUPPORTED_PLATFORMS).map(([name, domains]) => ({
    name,
    domains,
    example_urls: getExampleUrls(name, domains)
  }));
  
  res.status(200).json({
    success: true,
    data: {
      platforms,
      total_platforms: platforms.length,
      total_domains: Object.values(SUPPORTED_PLATFORMS).flat().length
    },
    meta: {
      note: 'This list includes the most common domains. yt-dlp may support additional domains for each platform.',
      last_updated: new Date().toISOString()
    }
  });
});

// Add this route to system.js
router.get('/', (req, res) => {
  res.redirect('/api/docs');
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);
  
  return parts.join(' ') || '0s';
}

// Helper function to generate example URLs
function getExampleUrls(platform, domains) {
  const examples = {
    youtube: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ'],
    tiktok: ['https://www.tiktok.com/@username/video/1234567890'],
    instagram: ['https://www.instagram.com/p/ABC123/'],
    twitter: ['https://twitter.com/username/status/1234567890'],
    facebook: ['https://www.facebook.com/watch/?v=1234567890']
  };
  
  return examples[platform] || [`https://${domains[0]}/example`];
}

module.exports = router;