import jwt from 'jsonwebtoken';
import database from '../config/database.js';

export const requireAdmin = async (req, res, next) => {
  try {
    // First, check if user is authenticated
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');

    // Get user from database to check admin status
    const user = await database.get(
      'SELECT id, username, is_admin FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Add user info to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};
