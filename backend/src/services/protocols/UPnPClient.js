import pkg from 'node-ssdp';
const { Client: SSDPClient } = pkg;
import BaseProtocolClient from './BaseProtocolClient.js';
import { request as httpRequest } from 'http';
import xml2js from 'xml2js';
const { parseString } = xml2js;

class UPnPProtocolClient extends BaseProtocolClient {
  constructor(config = {}) {
    super(config);
    this.client = new SSDPClient();
    this.devices = new Map();
    this.searching = false;
  }

  /**
   * Start UPnP discovery
   * @returns {Promise<boolean>}
   */
  async connect() {
    try {
      this.connected = true;
      console.log('UPnP discovery service started');
      return true;
    } catch (error) {
      console.error('UPnP start error:', error);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Stop UPnP discovery
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.client) {
        this.client.stop();
      }
      this.connected = false;
      this.searching = false;
      console.log('UPnP discovery service stopped');
    } catch (error) {
      console.error('UPnP stop error:', error);
    }
  }

  /**
   * Discover UPnP devices on network
   * @param {number} timeout - Discovery timeout in ms
   * @returns {Promise<Array<Object>>}
   */
  async discover(timeout = 5000) {
    return new Promise((resolve) => {
      this.devices.clear();
      this.searching = true;

      const discoveredDevices = [];

      // Listen for device responses
      this.client.on('response', (headers, statusCode, rinfo) => {
        const device = {
          location: headers.LOCATION,
          server: headers.SERVER,
          st: headers.ST,
          usn: headers.USN,
          address: rinfo.address,
          port: rinfo.port,
          discoveredAt: new Date()
        };

        const deviceId = headers.USN || headers.LOCATION;
        if (!this.devices.has(deviceId)) {
          this.devices.set(deviceId, device);
          discoveredDevices.push(device);
        }
      });

      // Search for media servers
      this.client.search('urn:schemas-upnp-org:device:MediaServer:1');

      // Also search for all UPnP devices
      setTimeout(() => {
        this.client.search('ssdp:all');
      }, 1000);

      // Stop after timeout
      setTimeout(() => {
        this.searching = false;
        resolve(discoveredDevices);
      }, timeout);
    });
  }

  /**
   * Get device description
   * @param {string} location - Device description URL
   * @returns {Promise<Object>}
   */
  async getDeviceDescription(location) {
    return new Promise((resolve, reject) => {
      httpRequest(location, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          parseString(data, (err, result) => {
            if (err) {
              return reject(err);
            }

            resolve(result);
          });
        });
      }).on('error', reject).end();
    });
  }

  /**
   * Get detailed device information
   * @param {Object} device - Device object from discovery
   * @returns {Promise<Object>}
   */
  async getDeviceInfo(device) {
    try {
      const description = await this.getDeviceDescription(device.location);

      const deviceInfo = description.root?.device?.[0] || {};

      return {
        friendlyName: deviceInfo.friendlyName?.[0],
        manufacturer: deviceInfo.manufacturer?.[0],
        modelName: deviceInfo.modelName?.[0],
        modelNumber: deviceInfo.modelNumber?.[0],
        serialNumber: deviceInfo.serialNumber?.[0],
        udn: deviceInfo.UDN?.[0],
        deviceType: deviceInfo.deviceType?.[0],
        services: deviceInfo.serviceList?.[0]?.service || [],
        ...device
      };
    } catch (error) {
      console.error('Error getting device info:', error);
      return {
        ...device,
        error: error.message
      };
    }
  }

  /**
   * List all discovered devices
   * @returns {Array<Object>}
   */
  list() {
    return Array.from(this.devices.values());
  }

  /**
   * Get discovered device count
   * @returns {number}
   */
  getDeviceCount() {
    return this.devices.size;
  }

  /**
   * Check if device exists by USN or location
   * @param {string} identifier - Device USN or location
   * @returns {boolean}
   */
  exists(identifier) {
    return this.devices.has(identifier);
  }

  /**
   * Get device by identifier
   * @param {string} identifier - Device USN or location
   * @returns {Object|null}
   */
  getDevice(identifier) {
    return this.devices.get(identifier) || null;
  }

  /**
   * Filter devices by type
   * @param {string} type - Device type (e.g., 'MediaServer')
   * @returns {Array<Object>}
   */
  filterByType(type) {
    return this.list().filter(device =>
      device.st && device.st.includes(type)
    );
  }

  /**
   * Get media servers
   * @returns {Array<Object>}
   */
  getMediaServers() {
    return this.filterByType('MediaServer');
  }

  /**
   * Clear discovered devices cache
   */
  clearCache() {
    this.devices.clear();
  }

  /**
   * Get protocol name
   * @returns {string}
   */
  getProtocol() {
    return 'upnp';
  }

  /**
   * Get connection status
   * @returns {string}
   */
  getStatus() {
    if (this.searching) {
      return `Discovering... (${this.devices.size} devices found)`;
    }

    return this.connected
      ? `Ready (${this.devices.size} devices discovered)`
      : 'Disconnected';
  }

  /**
   * Check if currently searching
   * @returns {boolean}
   */
  isSearching() {
    return this.searching;
  }

  /**
   * Not applicable for UPnP
   */
  async getFileStream() {
    throw new Error('getFileStream() not applicable for UPnP discovery service');
  }

  /**
   * Not applicable for UPnP
   */
  async getFileInfo() {
    throw new Error('getFileInfo() not applicable for UPnP discovery service');
  }
}

export default UPnPProtocolClient;
