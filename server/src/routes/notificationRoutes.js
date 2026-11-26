import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { Notification } from '../models/index.js';
import { asyncHandler } from '../utils/errors.js';

const router = express.Router();

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { channel, status, eventType, search, page = '1', limit = '25' } = req.query;
    const filter = { organizationId: req.organizationId };

    if (req.user.role !== 'admin') {
      filter.$or = [
        { recipientUserId: req.user._id },
        { recipient: req.user.email },
        ...(req.user.phone ? [{ recipient: req.user.phone }] : []),
      ];
    }

    if (channel) filter.channel = channel;
    if (status) filter.status = status;
    if (eventType) filter.eventType = eventType;

    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      const searchCond = [{ recipient: regex }, { subject: regex }, { message: regex }];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchCond }];
        delete filter.$or;
      } else {
        filter.$or = searchCond;
      }
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Notification.countDocuments(filter),
    ]);

    res.json({
      success: true,
      notifications,
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
