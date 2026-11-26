import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { AuditLog } from '../models/index.js';
import { asyncHandler } from '../utils/errors.js';

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorizeRoles('admin'),
  asyncHandler(async (req, res) => {
    const { action, actorRole, entityType, search, from, to, page = '1', limit = '25' } = req.query;
    const filter = { organizationId: req.organizationId };

    if (action) filter.action = action;
    if (actorRole) filter.actorRole = actorRole;
    if (entityType) filter.entityType = entityType;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ action: regex }, { actorName: regex }, { entityType: regex }];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  })
);

export default router;
