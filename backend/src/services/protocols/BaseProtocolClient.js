/**
 * Base Protocol Client Interface
 * All network protocol clients should extend this class
 */
class BaseProtocolClient {
  constructor(config) {
    this.config = config;
    this.connected = false;
  }

  /**
   * Connect to the remote source
   * @returns {Promise<boolean>} Connection status
   */
  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }

  /**
   * Disconnect from the remote source
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  /**
   * List files and directories at path
   * @param {string} path - Remote path
   * @returns {Promise<Array<Object>>} List of files/directories
   */
  async list(path = '/') {
    throw new Error('list() must be implemented by subclass');
  }

  /**
   * Get file stream for reading
   * @param {string} path - Remote file path
   * @returns {Promise<ReadableStream>} File stream
   */
  async getFileStream(path) {
    throw new Error('getFileStream() must be implemented by subclass');
  }

  /**
   * Get file information
   * @param {string} path - Remote file path
   * @returns {Promise<Object>} File information
   */
  async getFileInfo(path) {
    throw new Error('getFileInfo() must be implemented by subclass');
  }

  /**
   * Check if path exists
   * @param {string} path - Remote path
   * @returns {Promise<boolean>} True if exists
   */
  async exists(path) {
    throw new Error('exists() must be implemented by subclass');
  }

  /**
   * Test connection
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      await this.connect();
      await this.disconnect();
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get protocol name
   * @returns {string} Protocol name
   */
  getProtocol() {
    throw new Error('getProtocol() must be implemented by subclass');
  }

  /**
   * Is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected;
  }
}

export default BaseProtocolClient;
