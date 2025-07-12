const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import custom modules
const { logger, requestLoggingMiddleware, logStartup, logShutdown } = require('./utils/logger');
const videoRoutes = require('./routes/video');
const systemRoutes = require('./routes/system');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting disabled for high-volume API usage
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per windowMs
//   message: {
//     error: 'Too many requests from this IP, please try again later.',
//     retryAfter: '15 minutes'
//   },
//   standardHeaders: true,
//   legacyHeaders: false
// });

// Middleware setup
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// app.use(limiter); // Rate limiting disabled
app.use(requestLoggingMiddleware);

// Mount routes
app.use('/', systemRoutes);
app.use('/', videoRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found. Check /api/docs for available endpoints.'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error', { 
    error: error.message, 
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error occurred.'
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logShutdown('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  logShutdown('SIGINT');
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logStartup(PORT);
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📚 API Documentation: http://0.0.0.0:${PORT}/api/docs`);
  console.log(`❤️  Health Check: http://0.0.0.0:${PORT}/health`);
});

module.exports = app;