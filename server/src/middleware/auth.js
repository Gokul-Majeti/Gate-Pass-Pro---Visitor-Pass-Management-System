import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      organizationId: String(user.organizationId),
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

/**
 * Authenticates requests via Bearer JWT header (or query token for file download links).
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || '';
  let token = '';

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof req.query.token === 'string' && req.query.token.trim()) {
    token = req.query.token.trim();
  }

  if (!token) {
    throw new AppError('Authentication token required', 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError('Invalid or expired authentication token', 401);
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw new AppError('User account not found or inactive', 401);
  }

  req.user = user;
  req.organizationId = user.organizationId;
  next();
});

/**
 * Role-Based Access Control (RBAC) guard middleware.
 */
export function authorizeRoles(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied: role '${req.user.role}' is not permitted for this operation`,
          403
        )
      );
    }
    return next();
  };
}
