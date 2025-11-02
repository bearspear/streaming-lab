import { Client as FTPClient } from 'basic-ftp';
import BaseProtocolClient from './BaseProtocolClient.js';
import { Readable } from 'stream';

class FTPProtocolClient extends BaseProtocolClient {
  constructor(config) {
    super(config);
    this.client = new FTPClient();
    this.client.ftp.verbose = false; // Disable verbose logging
  }

  /**
   * Connect to FTP server
   * @returns {Promise<boolean>}
   */
  async connect() {
    try {
      await this.client.access({
        host: this.config.host,
        port: this.config.port || 21,
        user: this.config.username || 'anonymous',
        password: this.config.password || 'anonymous@',
        secure: this.config.secure || false
      });

      this.connected = true;
      console.log(`Connected to FTP server: ${this.config.host}`);
      return true;
    } catch (error) {
      console.error('FTP connection error:', error);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Disconnect from FTP server
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      this.client.close();
      this.connected = false;
      console.log('Disconnected from FTP server');
    } catch (error) {
      console.error('FTP disconnection error:', error);
    }
  }

  /**
   * List files and directories
   * @param {string} path - Remote path
   * @returns {Promise<Array<Object>>}
   */
  async list(path = '/') {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const files = await this.client.list(path);

      return files.map(file => ({
        name: file.name,
        path: `${path}/${file.name}`.replace('//', '/'),
        type: file.isDirectory ? 'directory' : 'file',
        size: file.size,
        modifiedAt: file.modifiedAt,
        isDirectory: file.isDirectory,
        isFile: file.isFile
      }));
    } catch (error) {
      console.error('FTP list error:', error);
      throw error;
    }
  }

  /**
   * Get file stream
   * @param {string} path - Remote file path
   * @returns {Promise<ReadableStream>}
   */
  async getFileStream(path) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const stream = new Readable({
        read() {}
      });

      // Download file and pipe to stream
      await this.client.downloadTo(stream, path);

      return stream;
    } catch (error) {
      console.error('FTP get file stream error:', error);
      throw error;
    }
  }

  /**
   * Download file to writable stream
   * @param {WritableStream} destination - Destination stream
   * @param {string} path - Remote file path
   * @returns {Promise<void>}
   */
  async downloadToStream(destination, path) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      await this.client.downloadTo(destination, path);
    } catch (error) {
      console.error('FTP download error:', error);
      throw error;
    }
  }

  /**
   * Get file information
   * @param {string} path - Remote file path
   * @returns {Promise<Object>}
   */
  async getFileInfo(path) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const size = await this.client.size(path);
      const modifiedAt = await this.client.lastMod(path);

      return {
        path,
        size,
        modifiedAt,
        exists: true
      };
    } catch (error) {
      console.error('FTP get file info error:', error);
      return {
        path,
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Check if path exists
   * @param {string} path - Remote path
   * @returns {Promise<boolean>}
   */
  async exists(path) {
    try {
      const info = await this.getFileInfo(path);
      return info.exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Change working directory
   * @param {string} path - Directory path
   * @returns {Promise<void>}
   */
  async cd(path) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      await this.client.cd(path);
    } catch (error) {
      console.error('FTP cd error:', error);
      throw error;
    }
  }

  /**
   * Get current working directory
   * @returns {Promise<string>}
   */
  async pwd() {
    try {
      if (!this.connected) {
        await this.connect();
      }

      return await this.client.pwd();
    } catch (error) {
      console.error('FTP pwd error:', error);
      throw error;
    }
  }

  /**
   * Get protocol name
   * @returns {string}
   */
  getProtocol() {
    return 'ftp';
  }

  /**
   * Get connection status message
   * @returns {string}
   */
  getStatus() {
    return this.connected
      ? `Connected to ${this.config.host}:${this.config.port || 21}`
      : 'Disconnected';
  }
}

export default FTPProtocolClient;
