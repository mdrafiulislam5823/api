const winston = require('winston');

// Configure logger for auth middleware
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth-middleware' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * API Key authentication middleware
 * Validates API key from header or query parameter
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateApiKey = (req, res, next) => {
  // Extract API key from header or query parameter
  const apiKey = req.headers['x-api-key'] || 
                 req.headers['X-API-Key'] || 
                 req.query.apiKey;
  
  // Check if API key is provided
  if (!apiKey) {
    logger.warn('API key missing', { 
      ip: req.ip, 
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    return res.status(401).json({
      success: false,
      error: 'API key is required. Provide it in X-API-Key header or apiKey query parameter.',
      code: 'MISSING_API_KEY'
    });
  }
  
  // Validate API key
  const validApiKey = process.env.API_KEY || 'your-secret-api-key';
  
  if (apiKey !== validApiKey) {
    logger.warn('Invalid API key attempt', { 
      ip: req.ip, 
      providedKey: apiKey.substring(0, 5) + '...', 
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    return res.status(403).json({
      success: false,
      error: 'Invalid API key provided.',
      code: 'INVALID_API_KEY'
    });
  }
  
  // Log successful authentication
  logger.info('API key authenticated successfully', {
    ip: req.ip,
    path: req.path
  });
  
  next();
};

/**
 * Optional authentication middleware
 * Validates API key if provided, but doesn't require it
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || 
                 req.headers['X-API-Key'] || 
                 req.query.apiKey;
  
  if (!apiKey) {
    // No API key provided, continue without authentication
    req.authenticated = false;
    return next();
  }
  
  const validApiKey = process.env.API_KEY || 'your-secret-api-key';
  
  if (apiKey === validApiKey) {
    req.authenticated = true;
    logger.info('Optional API key authenticated', { ip: req.ip, path: req.path });
  } else {
    req.authenticated = false;
    logger.warn('Invalid optional API key', { ip: req.ip, path: req.path });
  }
  
  next();
};

module.exports = {
  authenticateApiKey,
  optionalAuth
};