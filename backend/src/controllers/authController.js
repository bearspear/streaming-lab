import bcrypt from 'bcrypt';
import database from '../config/database.js';
import { generateToken } from '../middleware/auth.js';

const SALT_ROUNDS = 10;

export const register = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await database.get(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const result = await database.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    );

    // Generate token
    const token = generateToken(result.id, username);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: result.id,
        username,
        is_admin: false
      },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await database.get(
      'SELECT id, username, password_hash, is_admin FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id, user.username);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin === 1
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

export const verify = async (req, res) => {
  try {
    // If we reach here, the token was valid (checked by authenticateToken middleware)
    // Fetch fresh user data from database to get is_admin status
    const user = await database.get(
      'SELECT id, username, is_admin FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ valid: false, error: 'User not found' });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin === 1
      }
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ valid: false, error: 'Failed to verify token' });
  }
};
