const { body, validationResult } = require('express-validator');
const winston = require('winston');

// Configure logger for validation middleware
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'validation-middleware' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Supported video platforms and their domain patterns
const SUPPORTED_PLATFORMS = {
  youtube: ['youtube.com', 'youtu.be', 'm.youtube.com'],
  tiktok: ['tiktok.com', 'm.tiktok.com', 'vm.tiktok.com'],
  instagram: ['instagram.com', 'm.instagram.com'],
  capcut: ['capcut.com', 'capcut.net'],
  twitter: ['twitter.com', 'x.com', 'm.twitter.com', 'mobile.twitter.com'],
  facebook: ['facebook.com', 'm.facebook.com', 'fb.watch'],
  reddit: ['reddit.com', 'm.reddit.com', 'v.redd.it'],
  twitch: ['twitch.tv', 'm.twitch.tv', 'clips.twitch.tv'],
  dailymotion: ['dailymotion.com', 'dai.ly'],
  vimeo: ['vimeo.com', 'player.vimeo.com']
};

/**
 * Check if a URL belongs to a supported platform
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if supported, false otherwise
 */
const isSupportedPlatform = (url) => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    
    // Check against all supported platforms
    for (const [platform, domains] of Object.entries(SUPPORTED_PLATFORMS)) {
      if (domains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Get platform name from URL
 * @param {string} url - The URL to analyze
 * @returns {string} - Platform name or 'unknown'
 */
const getPlatformFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    
    for (const [platform, domains] of Object.entries(SUPPORTED_PLATFORMS)) {
      if (domains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
        return platform;
      }
    }
    
    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
};

/**
 * Sanitize URL to prevent injection attacks
 * @param {string} url - The URL to sanitize
 * @returns {string} - Sanitized URL
 */
const sanitizeUrl = (url) => {
  if (typeof url !== 'string') {
    throw new Error('URL must be a string');
  }
  
  // Remove any potential script tags or javascript: protocols
  const sanitized = url
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .trim();
  
  return sanitized;
};

/**
 * Video URL validation rules
 */
const validateVideoUrl = [
  body('url')
    .exists()
    .withMessage('URL is required')
    .isString()
    .withMessage('URL must be a string')
    .isLength({ min: 10, max: 2000 })
    .withMessage('URL must be between 10 and 2000 characters')
    .custom((value) => {
      // Sanitize the URL
      const sanitizedUrl = sanitizeUrl(value);
      
      // Validate URL format
      try {
        const urlObj = new URL(sanitizedUrl);
        
        // Check protocol
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          throw new Error('URL must use HTTP or HTTPS protocol');
        }
        
        // Check if it's a supported platform
        if (!isSupportedPlatform(sanitizedUrl)) {
          const supportedList = Object.values(SUPPORTED_PLATFORMS)
            .flat()
            .slice(0, 10) // Show first 10 domains
            .join(', ');
          
          throw new Error(
            `URL must be from a supported platform. Supported domains include: ${supportedList}, and more.`
          );
        }
        
        return true;
      } catch (error) {
        if (error.message.includes('supported platform')) {
          throw error;
        }
        throw new Error('Please provide a valid HTTP/HTTPS URL');
      }
    })
    .customSanitizer((value) => {
      return sanitizeUrl(value);
    })
];

/**
 * Optional parameters validation
 */
const validateOptionalParams = [
  body('quality')
    .optional()
    .isIn(['best', 'worst', 'bestvideo', 'bestaudio', 'worstvideo', 'worstaudio'])
    .withMessage('Quality must be one of: best, worst, bestvideo, bestaudio, worstvideo, worstaudio'),
  
  body('format')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Format must be a string with maximum 50 characters'),
  
  body('extract_flat')
    .optional()
    .isBoolean()
    .withMessage('extract_flat must be a boolean value')
];

/**
 * Handle validation errors middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    logger.warn('Validation failed', {
      ip: req.ip,
      path: req.path,
      errors: errorDetails,
      body: req.body
    });
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errorDetails,
      code: 'VALIDATION_ERROR'
    });
  }
  
  // Log successful validation
  const platform = getPlatformFromUrl(req.body.url);
  logger.info('URL validation successful', {
    ip: req.ip,
    path: req.path,
    platform: platform,
    url: req.body.url.substring(0, 50) + '...'
  });
  
  // Add platform info to request for later use
  req.platform = platform;
  
  next();
};

/**
 * Complete validation chain for video URLs
 */
const validateVideoRequest = [
  ...validateVideoUrl,
  ...validateOptionalParams,
  handleValidationErrors
];

/**
 * Basic validation chain for video URLs only
 */
const validateVideoUrlOnly = [
  ...validateVideoUrl,
  handleValidationErrors
];

module.exports = {
  validateVideoRequest,
  validateVideoUrlOnly,
  validateVideoUrl,
  validateOptionalParams,
  handleValidationErrors,
  isSupportedPlatform,
  getPlatformFromUrl,
  sanitizeUrl,
  SUPPORTED_PLATFORMS
};