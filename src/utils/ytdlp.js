const { exec } = require('child_process');
const util = require('util');
const winston = require('winston');

const execAsync = util.promisify(exec);

// Configure logger for yt-dlp utilities
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ytdlp-utils' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Execute yt-dlp command with proper error handling and timeouts
 * @param {string} command - The yt-dlp command to execute
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @param {number} maxBuffer - Maximum buffer size (default: 10MB)
 * @returns {Promise<string>} - Command output
 */
const executeYtDlp = async (command, timeout = 30000, maxBuffer = 1024 * 1024 * 10) => {
  try {
    logger.info('Executing yt-dlp command', {
      command: command.replace(/https?:\/\/[^\s]+/g, '[URL_HIDDEN]'),
      timeout,
      maxBuffer
    });
    
    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8'
      }
    });
    
    const executionTime = Date.now() - startTime;
    
    // Log warnings from stderr (yt-dlp often outputs warnings to stderr)
    if (stderr && !stderr.includes('WARNING')) {
      logger.warn('yt-dlp stderr output', {
        stderr: stderr.substring(0, 500),
        executionTime
      });
    }
    
    logger.info('yt-dlp command completed successfully', {
      executionTime,
      outputLength: stdout.length
    });
    
    return stdout;
  } catch (error) {
    const executionTime = Date.now() - Date.now();
    
    // Enhanced error handling with specific error types
    let errorMessage = 'Failed to process video URL';
    let errorCode = 'YTDLP_ERROR';
    
    if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Request timed out. The video might be too large or the server is slow.';
      errorCode = 'TIMEOUT_ERROR';
    } else if (error.code === 'ENOENT') {
      errorMessage = 'yt-dlp is not installed or not found in PATH.';
      errorCode = 'YTDLP_NOT_FOUND';
    } else if (error.stderr) {
      // Parse common yt-dlp errors
      const stderr = error.stderr.toLowerCase();
      
      if (stderr.includes('video unavailable') || stderr.includes('private video')) {
        errorMessage = 'Video is unavailable, private, or has been removed.';
        errorCode = 'VIDEO_UNAVAILABLE';
      } else if (stderr.includes('unsupported url')) {
        errorMessage = 'This URL is not supported by yt-dlp.';
        errorCode = 'UNSUPPORTED_URL';
      } else if (stderr.includes('no video formats found')) {
        errorMessage = 'No downloadable video formats found for this URL.';
        errorCode = 'NO_FORMATS';
      } else if (stderr.includes('sign in to confirm')) {
        errorMessage = 'This video requires authentication or age verification.';
        errorCode = 'AUTH_REQUIRED';
      } else if (stderr.includes('too many requests')) {
        errorMessage = 'Rate limited by the video platform. Please try again later.';
        errorCode = 'RATE_LIMITED';
      } else if (stderr.includes('network')) {
        errorMessage = 'Network error occurred while accessing the video.';
        errorCode = 'NETWORK_ERROR';
      }
    }
    
    logger.error('yt-dlp execution failed', {
      error: error.message,
      stderr: error.stderr ? error.stderr.substring(0, 500) : null,
      code: error.code,
      executionTime,
      errorCode
    });
    
    const customError = new Error(errorMessage);
    customError.code = errorCode;
    customError.originalError = error;
    throw customError;
  }
};

/**
 * Get video information using yt-dlp
 * @param {string} url - Video URL
 * @returns {Promise<Object>} - Video information
 */
const getVideoInfo = async (url) => {
  // Use shorter timeout and optimized flags for CapCut URLs
  const isCapCut = url.includes('capcut.com');
  const timeout = isCapCut ? 10000 : 30000; // Shorter timeout for CapCut
  const command = isCapCut 
    ? `yt-dlp --dump-json --no-warnings --socket-timeout 8 --retries 1 "${url}"`
    : `yt-dlp --dump-json --no-warnings "${url}"`;
  
  const output = await executeYtDlp(command, timeout);
  
  try {
    const videoInfo = JSON.parse(output.trim());
    
    // Extract and format relevant metadata
    return {
      title: videoInfo.title || 'Unknown Title',
      description: videoInfo.description || '',
      duration: videoInfo.duration || 0,
      thumbnail: videoInfo.thumbnail || '',
      uploader: videoInfo.uploader || videoInfo.channel || 'Unknown',
      upload_date: videoInfo.upload_date || '',
      view_count: videoInfo.view_count || 0,
      like_count: videoInfo.like_count || 0,
      webpage_url: videoInfo.webpage_url || url,
      extractor: videoInfo.extractor || 'unknown',
      format_count: videoInfo.formats ? videoInfo.formats.length : 0,
      age_limit: videoInfo.age_limit || 0,
      categories: videoInfo.categories || [],
      tags: videoInfo.tags || []
    };
  } catch (parseError) {
    logger.error('Failed to parse yt-dlp JSON output', {
      error: parseError.message,
      output: output.substring(0, 200)
    });
    throw new Error('Failed to parse video information from yt-dlp output.');
  }
};

/**
 * Get available download formats using yt-dlp
 * @param {string} url - Video URL
 * @returns {Promise<Object>} - Formatted download information
 */
const getDownloadFormats = async (url) => {
  // Use shorter timeout and optimized flags for CapCut URLs
  const isCapCut = url.includes('capcut.com');
  const timeout = isCapCut ? 15000 : 45000; // Shorter timeout for CapCut
  const command = isCapCut 
    ? `yt-dlp --list-formats --dump-json --no-warnings --socket-timeout 10 --retries 1 "${url}"`
    : `yt-dlp --list-formats --dump-json --no-warnings "${url}"`;
  
  const output = await executeYtDlp(command, timeout);
  
  try {
    const lines = output.trim().split('\n').filter(line => line.trim());
    const videoInfo = JSON.parse(lines[lines.length - 1]); // Last line contains the main info
    
    // Special handling for CapCut URLs to extract direct media links
    if (url.includes('capcut.com')) {
      // Extract video and thumbnail URLs from CapCut data
      const videoUrl = videoInfo.url || videoInfo.formats?.[0]?.url || null;
      const thumbnailUrl = videoInfo.thumbnail || videoInfo.thumbnails?.[0]?.url || null;
      
      // Create format entry if we have a video URL
      const formats = [];
      if (videoUrl) {
        formats.push({
          format_id: 'capcut-video',
          url: videoUrl,
          ext: 'mp4',
          quality: 'default',
          filesize: null,
          filesize_approx: null,
          vcodec: 'h264',
          acodec: 'aac',
          width: videoInfo.width || null,
          height: videoInfo.height || null,
          fps: videoInfo.fps || null,
          tbr: videoInfo.tbr || null,
          abr: null,
          vbr: null,
          resolution: videoInfo.resolution || null,
          aspect_ratio: videoInfo.aspect_ratio || null
        });
      }
      
      return {
        title: videoInfo.title || 'CapCut Content',
        webpage_url: videoInfo.webpage_url || url,
        duration: videoInfo.duration || 0,
        thumbnail: thumbnailUrl,
        formats: {
          video_audio: formats,
          audio_only: [],
          video_only: []
        },
        total_formats: formats.length,
        best_video: formats.length > 0 ? formats[0] : null,
        best_audio: null,
        recommended: {
          video: formats.length > 0 ? formats[0] : null,
          audio: null
        }
      };
    }
    
    if (!videoInfo.formats || videoInfo.formats.length === 0) {
      throw new Error('No downloadable formats found for this video.');
    }
    
    // Process and categorize formats
    const formats = videoInfo.formats
      .filter(format => format.url && (format.vcodec !== 'none' || format.acodec !== 'none'))
      .map(format => ({
        format_id: format.format_id,
        url: format.url,
        ext: format.ext,
        quality: format.format_note || format.quality || 'unknown',
        filesize: format.filesize || null,
        filesize_approx: format.filesize_approx || null,
        vcodec: format.vcodec || 'none',
        acodec: format.acodec || 'none',
        width: format.width || null,
        height: format.height || null,
        fps: format.fps || null,
        tbr: format.tbr || null,
        abr: format.abr || null,
        vbr: format.vbr || null,
        resolution: format.resolution || null,
        aspect_ratio: format.aspect_ratio || null
      }));
    
    // Categorize formats
    const videoFormats = formats
      .filter(f => f.vcodec !== 'none' && f.acodec !== 'none')
      .sort((a, b) => (b.height || 0) - (a.height || 0)); // Sort by quality (height)
    
    const audioFormats = formats
      .filter(f => f.vcodec === 'none' && f.acodec !== 'none')
      .sort((a, b) => (b.abr || 0) - (a.abr || 0)); // Sort by audio bitrate
    
    const videoOnlyFormats = formats
      .filter(f => f.vcodec !== 'none' && f.acodec === 'none')
      .sort((a, b) => (b.height || 0) - (a.height || 0)); // Sort by quality
    
    return {
      title: videoInfo.title || 'Unknown Title',
      webpage_url: videoInfo.webpage_url || url,
      duration: videoInfo.duration || 0,
      formats: {
        video_audio: videoFormats.slice(0, 10), // Limit to prevent huge responses
        audio_only: audioFormats.slice(0, 5),
        video_only: videoOnlyFormats.slice(0, 10)
      },
      total_formats: formats.length,
      best_video: videoFormats.length > 0 ? videoFormats[0] : null,
      best_audio: audioFormats.length > 0 ? audioFormats[0] : null,
      recommended: {
        video: videoFormats.find(f => f.height && f.height <= 720) || videoFormats[0] || null,
        audio: audioFormats.find(f => f.abr && f.abr >= 128) || audioFormats[0] || null
      }
    };
  } catch (parseError) {
    logger.error('Failed to parse yt-dlp formats output', {
      error: parseError.message,
      output: output.substring(0, 200)
    });
    throw new Error('Failed to parse download formats from yt-dlp output.');
  }
};

/**
 * Check if yt-dlp is available and working
 * @returns {Promise<boolean>} - True if yt-dlp is available
 */
const checkYtDlpAvailability = async () => {
  try {
    await executeYtDlp('yt-dlp --version', 5000);
    return true;
  } catch (error) {
    logger.error('yt-dlp availability check failed', { error: error.message });
    return false;
  }
};

/**
 * Get yt-dlp version information
 * @returns {Promise<string>} - Version string
 */
const getYtDlpVersion = async () => {
  try {
    const output = await executeYtDlp('yt-dlp --version', 5000);
    return output.trim();
  } catch (error) {
    logger.error('Failed to get yt-dlp version', { error: error.message });
    throw new Error('Unable to determine yt-dlp version.');
  }
};

/**
 * Format file size in human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return 'Unknown';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Format duration in human readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration string
 */
const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return 'Unknown';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
};

module.exports = {
  executeYtDlp,
  getVideoInfo,
  getDownloadFormats,
  checkYtDlpAvailability,
  getYtDlpVersion,
  formatFileSize,
  formatDuration
};