import SMB2 from '@marsaud/smb2';
import BaseProtocolClient from './BaseProtocolClient.js';
import { Readable } from 'stream';

class SMBProtocolClient extends BaseProtocolClient {
  constructor(config) {
    super(config);
    this.client = null;
  }

  /**
   * Connect to SMB server
   * @returns {Promise<boolean>}
   */
  async connect() {
    try {
      this.client = new SMB2({
        share: this.config.share || `\\\\${this.config.host}\\${this.config.shareName}`,
        domain: this.config.domain || 'WORKGROUP',
        username: this.config.username,
        password: this.config.password,
        port: this.config.port || 445
      });

      this.connected = true;
      console.log(`Connected to SMB server: ${this.config.host}`);
      return true;
    } catch (error) {
      console.error('SMB connection error:', error);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Disconnect from SMB server
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.client) {
        // SMB2 client doesn't have explicit disconnect
        this.client = null;
      }
      this.connected = false;
      console.log('Disconnected from SMB server');
    } catch (error) {
      console.error('SMB disconnection error:', error);
    }
  }

  /**
   * List files and directories
   * @param {string} path - Remote path
   * @returns {Promise<Array<Object>>}
   */
  async list(path = '') {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to SMB server'));
      }

      this.client.readdir(path, (err, files) => {
        if (err) {
          console.error('SMB list error:', err);
          return reject(err);
        }

        const fileList = files.map(file => ({
          name: file,
          path: path ? `${path}/${file}` : file,
          type: 'file', // SMB2 doesn't provide type info in readdir
          isDirectory: false,
          isFile: true
        }));

        resolve(fileList);
      });
    });
  }

  /**
   * Get file stream
   * @param {string} path - Remote file path
   * @returns {Promise<ReadableStream>}
   */
  async getFileStream(path) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to SMB server'));
      }

      try {
        const stream = this.client.createReadStream(path);

        stream.on('error', (error) => {
          console.error('SMB stream error:', error);
          reject(error);
        });

        resolve(stream);
      } catch (error) {
        console.error('SMB get file stream error:', error);
        reject(error);
      }
    });
  }

  /**
   * Read file content to buffer
   * @param {string} path - Remote file path
   * @returns {Promise<Buffer>}
   */
  async readFile(path) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to SMB server'));
      }

      this.client.readFile(path, (err, data) => {
        if (err) {
          console.error('SMB read file error:', err);
          return reject(err);
        }

        resolve(data);
      });
    });
  }

  /**
   * Get file information
   * @param {string} path - Remote file path
   * @returns {Promise<Object>}
   */
  async getFileInfo(path) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to SMB server'));
      }

      this.client.stat(path, (err, stats) => {
        if (err) {
          console.error('SMB stat error:', err);
          return resolve({
            path,
            exists: false,
            error: err.message
          });
        }

        resolve({
          path,
          size: stats.size,
          modifiedAt: stats.mtime,
          createdAt: stats.birthtime,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          exists: true
        });
      });
    });
  }

  /**
   * Check if path exists
   * @param {string} path - Remote path
   * @returns {Promise<boolean>}
   */
  async exists(path) {
    return new Promise((resolve) => {
      if (!this.connected) {
        return resolve(false);
      }

      this.client.exists(path, (err, exists) => {
        resolve(!err && exists);
      });
    });
  }

  /**
   * Create directory
   * @param {string} path - Directory path
   * @returns {Promise<void>}
   */
  async mkdir(path) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to SMB server'));
      }

      this.client.mkdir(path, (err) => {
        if (err) {
          console.error('SMB mkdir error:', err);
          return reject(err);
        }

        resolve();
      });
    });
  }

  /**
   * Delete file
   * @param {string} path - File path
   * @returns {Promise<void>}
   */
  async unlink(path) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to SMB server'));
      }

      this.client.unlink(path, (err) => {
        if (err) {
          console.error('SMB unlink error:', err);
          return reject(err);
        }

        resolve();
      });
    });
  }

  /**
   * Remove directory
   * @param {string} path - Directory path
   * @returns {Promise<void>}
   */
  async rmdir(path) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to SMB server'));
      }

      this.client.rmdir(path, (err) => {
        if (err) {
          console.error('SMB rmdir error:', err);
          return reject(err);
        }

        resolve();
      });
    });
  }

  /**
   * Get protocol name
   * @returns {string}
   */
  getProtocol() {
    return 'smb';
  }

  /**
   * Get connection status message
   * @returns {string}
   */
  getStatus() {
    return this.connected
      ? `Connected to ${this.config.host}\\${this.config.shareName || 'share'}`
      : 'Disconnected';
  }
}

export default SMBProtocolClient;
