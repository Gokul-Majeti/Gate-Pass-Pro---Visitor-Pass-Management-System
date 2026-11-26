import express from 'express';
import { z } from 'zod';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { User, USER_ROLES } from '../models/index.js';
import { getRequestIp, recordAudit } from '../services/auditService.js';
import { sendEmailNotification } from '../services/notificationService.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { validateSchema } from '../utils/validate.js';

const router = express.Router();

const createStaffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().max(30).optional().default(''),
  password: z.string().min(6).max(100),
  role: z.enum(USER_ROLES),
  department: z.string().trim().max(120).optional().default('General'),
  locationName: z.string().trim().max(120).optional().default('Main Campus'),
  isVerified: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(USER_ROLES).optional(),
  department: z.string().trim().max(120).optional(),
  locationName: z.string().trim().max(120).optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
});

router.get(
  '/hosts',
  authenticate,
  asyncHandler(async (req, res) => {
    const { locationName, search } = req.query;
    const filter = {
      organizationId: req.organizationId,
      role: { $in: ['host', 'admin'] },
      isActive: true,
    };

    if (locationName) {
      filter.locationName = locationName;
    }
    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ name: regex }, { department: regex }, { email: regex }];
    }

    const hosts = await User.find(filter)
      .select('name email department locationName role')
      .sort({ name: 1 });

    res.json({
      success: true,
      hosts,
    });
  })
);

router.get(
  '/',
  authenticate,
  authorizeRoles('admin'),
  asyncHandler(async (req, res) => {
    const { role, locationName, isActive, search } = req.query;
    const filter = { organizationId: req.organizationId };

    if (role) filter.role = role;
    if (locationName) filter.locationName = locationName;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { department: regex }];
    }

    const users = await User.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      users,
    });
  })
);

router.post(
  '/',
  authenticate,
  authorizeRoles('admin'),
  validateSchema(createStaffSchema),
  asyncHandler(async (req, res) => {
    const data = req.body;
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      throw new AppError('A user with this email already exists', 409);
    }

    const passwordHash = await User.hashPassword(data.password);
    const user = await User.create({
      organizationId: req.organizationId,
      locationName: data.locationName,
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role: data.role,
      department: data.department,
      isVerified: data.isVerified,
    });

    await sendEmailNotification({
      organizationId: req.organizationId,
      recipientUserId: user._id,
      to: user.email,
      subject: 'Your GatePass Staff Account is Ready',
      message: `Hello ${user.name}, an administrator created your ${user.role} account at ${user.locationName}.`,
      eventType: 'STAFF_ACCOUNT_CREATED',
    });

    await recordAudit({
      organizationId: req.organizationId,
      actor: req.user,
      action: 'STAFF_CREATED',
      entityType: 'User',
      entityId: user._id,
      metadata: { email: user.email, role: user.role, locationName: user.locationName },
      ipAddress: getRequestIp(req),
    });

    res.status(201).json({
      success: true,
      user,
    });
  })
);

router.patch(
  '/:id',
  authenticate,
  authorizeRoles('admin'),
  validateSchema(updateUserSchema),
  asyncHandler(async (req, res) => {
    const targetUser = await User.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    });

    if (!targetUser) {
      throw new AppError('User not found in your organization', 404);
    }

    if (String(targetUser._id) === String(req.user._id)) {
      if (req.body.isActive === false) {
        throw new AppError('You cannot deactivate your own admin account', 400);
      }
      if (req.body.role && req.body.role !== 'admin') {
        throw new AppError('You cannot demote your own active admin role', 400);
      }
    }

    Object.assign(targetUser, req.body);
    await targetUser.save();

    await recordAudit({
      organizationId: req.organizationId,
      actor: req.user,
      action: 'STAFF_UPDATED',
      entityType: 'User',
      entityId: targetUser._id,
      metadata: req.body,
      ipAddress: getRequestIp(req),
    });

    res.json({
      success: true,
      user: targetUser,
    });
  })
);

export default router;
