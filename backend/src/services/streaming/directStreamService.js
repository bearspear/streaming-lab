import { createReadStream, statSync } from 'fs';
import { extname } from 'path';

class DirectStreamService {
  /**
   * Get MIME type for video file
   * @param {string} filePath - Path to video file
   * @returns {string} MIME type
   */
  getMimeType(filePath) {
    const ext = extname(filePath).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.flv': 'video/x-flv',
      '.wmv': 'video/x-ms-wmv',
      '.m4v': 'video/mp4'
    };

    return mimeTypes[ext] || 'video/mp4';
  }

  /**
   * Stream video file with HTTP range support
   * @param {string} filePath - Path to video file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  streamFile(filePath, req, res) {
    try {
      // Get file stats
      const stat = statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        // Parse range header
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        // Create read stream for range
        const stream = createReadStream(filePath, { start, end });

        // Set headers for partial content
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': this.getMimeType(filePath)
        });

        // Pipe stream to response
        stream.pipe(res);

        // Handle errors
        stream.on('error', (error) => {
          console.error('Stream error:', error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Stream error' });
          }
        });
      } else {
        // No range header - stream entire file
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': this.getMimeType(filePath),
          'Accept-Ranges': 'bytes'
        });

        const stream = createReadStream(filePath);
        stream.pipe(res);

        stream.on('error', (error) => {
          console.error('Stream error:', error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Stream error' });
          }
        });
      }
    } catch (error) {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file' });
      }
    }
  }

  /**
   * Stream with bandwidth throttling (optional)
   * @param {string} filePath - Path to video file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} maxBytesPerSecond - Maximum bytes per second
   */
  streamWithThrottle(filePath, req, res, maxBytesPerSecond = 1024 * 1024) {
    try {
      const stat = statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      let start = 0;
      let end = fileSize - 1;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      }

      const chunkSize = (end - start) + 1;
      const stream = createReadStream(filePath, { start, end });

      // Set headers
      const statusCode = range ? 206 : 200;
      const headers = {
        'Content-Length': chunkSize,
        'Content-Type': this.getMimeType(filePath),
        'Accept-Ranges': 'bytes'
      };

      if (range) {
        headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
      }

      res.writeHead(statusCode, headers);

      // Throttle stream
      let bytesWritten = 0;
      const startTime = Date.now();

      stream.on('data', (chunk) => {
        bytesWritten += chunk.length;
        const elapsed = (Date.now() - startTime) / 1000;
        const expectedBytes = maxBytesPerSecond * elapsed;

        if (bytesWritten > expectedBytes) {
          // Pause stream to throttle
          stream.pause();
          const delay = ((bytesWritten - expectedBytes) / maxBytesPerSecond) * 1000;
          setTimeout(() => stream.resume(), delay);
        }
      });

      stream.pipe(res);

      stream.on('error', (error) => {
        console.error('Throttled stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error' });
        }
      });
    } catch (error) {
      console.error('Error in throttled streaming:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file' });
      }
    }
  }

  /**
   * Get file info for streaming
   * @param {string} filePath - Path to video file
   * @returns {Object} File information
   */
  getFileInfo(filePath) {
    try {
      const stat = statSync(filePath);
      return {
        exists: true,
        size: stat.size,
        mimeType: this.getMimeType(filePath),
        modified: stat.mtime
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const directStreamService = new DirectStreamService();
export default directStreamService;
