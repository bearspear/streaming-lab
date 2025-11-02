import { readdirSync, statSync, unlinkSync, rmdirSync, existsSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = process.env.CACHE_DIR || './data/cache';
const MAX_CACHE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB default
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

class CacheService {
  constructor() {
    this.cacheStats = {
      totalSize: 0,
      fileCount: 0,
      lastCleanup: null
    };
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    this.updateCacheStats();
    return {
      ...this.cacheStats,
      maxSize: MAX_CACHE_SIZE,
      usagePercent: (this.cacheStats.totalSize / MAX_CACHE_SIZE * 100).toFixed(2)
    };
  }

  /**
   * Update cache statistics
   */
  updateCacheStats() {
    if (!existsSync(CACHE_DIR)) {
      this.cacheStats = {
        totalSize: 0,
        fileCount: 0,
        lastCleanup: null
      };
      return;
    }

    let totalSize = 0;
    let fileCount = 0;

    const countDir = (dirPath) => {
      try {
        const files = readdirSync(dirPath);

        for (const file of files) {
          const filePath = join(dirPath, file);
          const stats = statSync(filePath);

          if (stats.isDirectory()) {
            countDir(filePath);
          } else {
            totalSize += stats.size;
            fileCount++;
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
      }
    };

    countDir(CACHE_DIR);

    this.cacheStats.totalSize = totalSize;
    this.cacheStats.fileCount = fileCount;
  }

  /**
   * Clean old cache files
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Object} Cleanup results
   */
  cleanOldFiles(maxAge = CACHE_TTL) {
    if (!existsSync(CACHE_DIR)) {
      return { deletedFiles: 0, freedSpace: 0 };
    }

    let deletedFiles = 0;
    let freedSpace = 0;
    const now = Date.now();

    const cleanDir = (dirPath) => {
      try {
        const files = readdirSync(dirPath);

        for (const file of files) {
          const filePath = join(dirPath, file);
          const stats = statSync(filePath);

          if (stats.isDirectory()) {
            cleanDir(filePath);

            // Try to remove empty directories
            try {
              const remainingFiles = readdirSync(filePath);
              if (remainingFiles.length === 0) {
                rmdirSync(filePath);
              }
            } catch (error) {
              // Directory not empty or other error, ignore
            }
          } else {
            const age = now - stats.mtime.getTime();

            if (age > maxAge) {
              const size = stats.size;
              try {
                unlinkSync(filePath);
                deletedFiles++;
                freedSpace += size;
                console.log(`Deleted old cache file: ${filePath}`);
              } catch (error) {
                console.error(`Error deleting file ${filePath}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error cleaning directory ${dirPath}:`, error);
      }
    };

    cleanDir(CACHE_DIR);

    this.cacheStats.lastCleanup = new Date();
    this.updateCacheStats();

    return {
      deletedFiles,
      freedSpace,
      freedSpaceMB: (freedSpace / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * Clean cache to fit within size limit
   * @param {number} targetSize - Target size in bytes
   * @returns {Object} Cleanup results
   */
  cleanToSize(targetSize = MAX_CACHE_SIZE) {
    this.updateCacheStats();

    if (this.cacheStats.totalSize <= targetSize) {
      return { deletedFiles: 0, freedSpace: 0, message: 'Cache within size limit' };
    }

    // Get all files with their stats
    const files = [];
    const collectFiles = (dirPath) => {
      try {
        const entries = readdirSync(dirPath);

        for (const entry of entries) {
          const filePath = join(dirPath, entry);
          const stats = statSync(filePath);

          if (stats.isDirectory()) {
            collectFiles(filePath);
          } else {
            files.push({
              path: filePath,
              size: stats.size,
              mtime: stats.mtime.getTime()
            });
          }
        }
      } catch (error) {
        console.error(`Error collecting files from ${dirPath}:`, error);
      }
    };

    collectFiles(CACHE_DIR);

    // Sort by oldest first (LRU)
    files.sort((a, b) => a.mtime - b.mtime);

    let currentSize = this.cacheStats.totalSize;
    let deletedFiles = 0;
    let freedSpace = 0;

    // Delete oldest files until we reach target size
    for (const file of files) {
      if (currentSize <= targetSize) break;

      try {
        unlinkSync(file.path);
        currentSize -= file.size;
        freedSpace += file.size;
        deletedFiles++;
        console.log(`Deleted cache file (size limit): ${file.path}`);
      } catch (error) {
        console.error(`Error deleting file ${file.path}:`, error);
      }
    }

    this.updateCacheStats();

    return {
      deletedFiles,
      freedSpace,
      freedSpaceMB: (freedSpace / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * Clear all cache
   * @returns {Object} Cleanup results
   */
  clearAll() {
    if (!existsSync(CACHE_DIR)) {
      return { deletedFiles: 0, freedSpace: 0 };
    }

    let deletedFiles = 0;
    let freedSpace = 0;

    const removeDir = (dirPath) => {
      try {
        const files = readdirSync(dirPath);

        for (const file of files) {
          const filePath = join(dirPath, file);
          const stats = statSync(filePath);

          if (stats.isDirectory()) {
            removeDir(filePath);
            rmdirSync(filePath);
          } else {
            freedSpace += stats.size;
            unlinkSync(filePath);
            deletedFiles++;
          }
        }
      } catch (error) {
        console.error(`Error removing directory ${dirPath}:`, error);
      }
    };

    removeDir(CACHE_DIR);

    this.updateCacheStats();

    return {
      deletedFiles,
      freedSpace,
      freedSpaceMB: (freedSpace / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * Delete cache for specific media item
   * @param {string} mediaItemId - Media item ID
   * @returns {Object} Cleanup results
   */
  clearMediaCache(mediaItemId) {
    const hlsDir = join(CACHE_DIR, `hls_${mediaItemId}`);
    let deletedFiles = 0;
    let freedSpace = 0;

    const removeDir = (dirPath) => {
      if (!existsSync(dirPath)) return;

      try {
        const files = readdirSync(dirPath);

        for (const file of files) {
          const filePath = join(dirPath, file);
          const stats = statSync(filePath);

          if (stats.isDirectory()) {
            removeDir(filePath);
            rmdirSync(filePath);
          } else {
            freedSpace += stats.size;
            unlinkSync(filePath);
            deletedFiles++;
          }
        }

        rmdirSync(dirPath);
      } catch (error) {
        console.error(`Error removing directory ${dirPath}:`, error);
      }
    };

    // Remove HLS directory
    removeDir(hlsDir);

    // Remove transcoded files
    try {
      const files = readdirSync(CACHE_DIR);
      for (const file of files) {
        if (file.startsWith(`${mediaItemId}_`)) {
          const filePath = join(CACHE_DIR, file);
          const stats = statSync(filePath);
          freedSpace += stats.size;
          unlinkSync(filePath);
          deletedFiles++;
        }
      }
    } catch (error) {
      console.error('Error removing transcoded files:', error);
    }

    this.updateCacheStats();

    return {
      deletedFiles,
      freedSpace,
      freedSpaceMB: (freedSpace / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * Perform routine cache maintenance
   * @returns {Object} Maintenance results
   */
  performMaintenance() {
    console.log('Starting cache maintenance...');

    const results = {
      oldFiles: this.cleanOldFiles(),
      sizeLimit: this.cleanToSize(),
      finalStats: this.getCacheStats()
    };

    console.log('Cache maintenance completed');
    return results;
  }
}

// Export singleton instance
const cacheService = new CacheService();

// Schedule automatic maintenance every 6 hours
setInterval(() => {
  cacheService.performMaintenance();
}, 6 * 60 * 60 * 1000);

export default cacheService;
