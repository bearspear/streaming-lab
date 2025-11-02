import database from '../config/database.js';
import FTPClient from '../services/protocols/FTPClient.js';
import SMBClient from '../services/protocols/SMBClient.js';
import UPnPClient from '../services/protocols/UPnPClient.js';
import bcrypt from 'bcrypt';

// Store active protocol clients
const activeClients = new Map();

// Singleton UPnP client for discovery
let upnpClient = null;

/**
 * Get or create protocol client
 */
function getProtocolClient(source) {
  const key = `${source.protocol}-${source.id}`;

  if (activeClients.has(key)) {
    return activeClients.get(key);
  }

  let client;
  const config = {
    host: source.host,
    port: source.port,
    username: source.username,
    password: source.password
  };

  switch (source.protocol) {
    case 'ftp':
      client = new FTPClient(config);
      break;
    case 'smb':
      config.shareName = source.base_path || '';
      config.domain = source.domain || 'WORKGROUP';
      client = new SMBClient(config);
      break;
    default:
      throw new Error(`Unsupported protocol: ${source.protocol}`);
  }

  activeClients.set(key, client);
  return client;
}

/**
 * Get all network sources
 */
export const getNetworkSources = async (req, res) => {
  try {
    const sources = await database.all(
      'SELECT id, name, protocol, host, port, username, base_path, enabled, created_at FROM network_sources'
    );

    res.json({
      count: sources.length,
      sources
    });
  } catch (error) {
    console.error('Error fetching network sources:', error);
    res.status(500).json({ error: 'Failed to fetch network sources' });
  }
};

/**
 * Get network source by ID
 */
export const getNetworkSource = async (req, res) => {
  try {
    const { id } = req.params;

    const source = await database.get(
      'SELECT id, name, protocol, host, port, username, base_path, enabled, created_at FROM network_sources WHERE id = ?',
      [id]
    );

    if (!source) {
      return res.status(404).json({ error: 'Network source not found' });
    }

    res.json(source);
  } catch (error) {
    console.error('Error fetching network source:', error);
    res.status(500).json({ error: 'Failed to fetch network source' });
  }
};

/**
 * Create network source
 */
export const createNetworkSource = async (req, res) => {
  try {
    const { name, protocol, host, port, username, password, base_path } = req.body;

    // Validate required fields
    if (!name || !protocol || !host) {
      return res.status(400).json({ error: 'Name, protocol, and host are required' });
    }

    // Validate protocol
    if (!['ftp', 'smb', 'upnp', 'local'].includes(protocol)) {
      return res.status(400).json({ error: 'Invalid protocol. Must be ftp, smb, upnp, or local' });
    }

    // Encrypt password if provided
    const encryptedPassword = password ? await bcrypt.hash(password, 10) : null;

    const result = await database.run(
      `INSERT INTO network_sources (name, protocol, host, port, username, password, base_path, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [name, protocol, host, port, username, encryptedPassword, base_path]
    );

    const source = await database.get(
      'SELECT id, name, protocol, host, port, username, base_path, enabled, created_at FROM network_sources WHERE id = ?',
      [result.id]
    );

    res.status(201).json(source);
  } catch (error) {
    console.error('Error creating network source:', error);
    res.status(500).json({ error: 'Failed to create network source' });
  }
};

/**
 * Update network source
 */
export const updateNetworkSource = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, host, port, username, password, base_path, enabled } = req.body;

    // Check if source exists
    const existing = await database.get(
      'SELECT id FROM network_sources WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Network source not found' });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (host !== undefined) {
      updates.push('host = ?');
      values.push(host);
    }
    if (port !== undefined) {
      updates.push('port = ?');
      values.push(port);
    }
    if (username !== undefined) {
      updates.push('username = ?');
      values.push(username);
    }
    if (password !== undefined) {
      const encryptedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(encryptedPassword);
    }
    if (base_path !== undefined) {
      updates.push('base_path = ?');
      values.push(base_path);
    }
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    await database.run(
      `UPDATE network_sources SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const source = await database.get(
      'SELECT id, name, protocol, host, port, username, base_path, enabled, created_at FROM network_sources WHERE id = ?',
      [id]
    );

    res.json(source);
  } catch (error) {
    console.error('Error updating network source:', error);
    res.status(500).json({ error: 'Failed to update network source' });
  }
};

/**
 * Delete network source
 */
export const deleteNetworkSource = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await database.run(
      'DELETE FROM network_sources WHERE id = ?',
      [id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Network source not found' });
    }

    // Remove client from cache
    const key = `*-${id}`;
    for (const [clientKey, client] of activeClients.entries()) {
      if (clientKey.includes(`-${id}`)) {
        await client.disconnect();
        activeClients.delete(clientKey);
      }
    }

    res.json({ message: 'Network source deleted successfully' });
  } catch (error) {
    console.error('Error deleting network source:', error);
    res.status(500).json({ error: 'Failed to delete network source' });
  }
};

/**
 * Test network source connection
 */
export const testConnection = async (req, res) => {
  try {
    const { id } = req.params;

    const source = await database.get(
      'SELECT * FROM network_sources WHERE id = ?',
      [id]
    );

    if (!source) {
      return res.status(404).json({ error: 'Network source not found' });
    }

    const client = getProtocolClient(source);
    const success = await client.testConnection();

    res.json({
      success,
      message: success ? 'Connection successful' : 'Connection failed'
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Browse network source directory
 */
export const browseDirectory = async (req, res) => {
  try {
    const { id } = req.params;
    const { path = '/' } = req.query;

    const source = await database.get(
      'SELECT * FROM network_sources WHERE id = ?',
      [id]
    );

    if (!source) {
      return res.status(404).json({ error: 'Network source not found' });
    }

    const client = getProtocolClient(source);

    if (!client.isConnected()) {
      await client.connect();
    }

    const files = await client.list(path);

    res.json({
      path,
      files
    });
  } catch (error) {
    console.error('Error browsing directory:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Discover UPnP devices
 */
export const discoverUPnP = async (req, res) => {
  try {
    const { timeout = 5000 } = req.query;

    // Create or get UPnP client
    if (!upnpClient) {
      upnpClient = new UPnPClient();
      await upnpClient.connect();
    }

    const devices = await upnpClient.discover(parseInt(timeout));

    // Get detailed info for each device
    const detailedDevices = await Promise.all(
      devices.map(device => upnpClient.getDeviceInfo(device))
    );

    res.json({
      count: detailedDevices.length,
      devices: detailedDevices
    });
  } catch (error) {
    console.error('Error discovering UPnP devices:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get UPnP media servers
 */
export const getMediaServers = async (req, res) => {
  try {
    if (!upnpClient) {
      upnpClient = new UPnPClient();
      await upnpClient.connect();
      await upnpClient.discover(5000);
    }

    const mediaServers = upnpClient.getMediaServers();

    res.json({
      count: mediaServers.length,
      servers: mediaServers
    });
  } catch (error) {
    console.error('Error getting media servers:', error);
    res.status(500).json({ error: error.message });
  }
};
