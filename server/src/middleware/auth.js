import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Protect middleware:
 * Verifies JWT token extracted from either:
 * 1. HttpOnly cookie ('token')
 * 2. Authorization header ('Bearer <token>')
 * Attaches the authenticated user to req.user
 */
export const protect = async (req, res, next) => {
  let token;

  // Check cookies first, then Authorization header
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route. Please log in.',
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not configured in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Authentication configuration error',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret);

    // Fetch user without password
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    let message = 'Not authorized to access this route';
    if (error.name === 'TokenExpiredError') {
      message = 'Your session has expired. Please log in again.';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Invalid authentication token. Please log in again.';
    }

    return res.status(401).json({
      success: false,
      message,
    });
  }
};

/**
 * Require Admin middleware:
 * Ensures the authenticated user has role === 'admin'
 * Must be preceded by protect middleware.
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Administrator privileges required.',
    });
  }
  next();
};
