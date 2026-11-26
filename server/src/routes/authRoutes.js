import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { authenticate, signAuthToken } from '../middleware/auth.js';
import { Organization, User, Visitor } from '../models/index.js';
import { getRequestIp, recordAudit } from '../services/auditService.js';
import { sendEmailNotification, sendSmsNotification } from '../services/notificationService.js';
import { generateOtpCode, getOtpExpiryDate, hashOtpCode, verifyOtpCode } from '../services/otpService.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { validateSchema } from '../utils/validate.js';

const router = express.Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().min(5).max(30).optional().default(''),
  password: z.string().min(6).max(100),
  company: z.string().trim().max(120).optional().default('Independent'),
  idType: z.enum(['national_id', 'passport', 'driving_license', 'employee_id', 'other']).optional().default('national_id'),
  idNumber: z.string().trim().max(60).optional().default(''),
  organizationId: z.string().trim().optional(),
  organizationSlug: z.string().trim().toLowerCase().optional(),
  locationName: z.string().trim().max(120).optional(),
  createOrganization: z.boolean().optional().default(false),
  organizationName: z.string().trim().min(2).max(120).optional(),
  industry: z.string().trim().max(80).optional().default('Corporate'),
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  department: z.string().trim().max(120).optional(),
  locationName: z.string().trim().max(120).optional(),
});

const sendOtpSchema = z.object({
  email: z.string().trim().email().toLowerCase().optional(),
  channel: z.enum(['email', 'sms', 'both']).optional().default('email'),
});

const verifyOtpSchema = z.object({
  email: z.string().trim().email().toLowerCase().optional(),
  otp: z.string().trim().length(6),
});

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

router.post(
  '/register',
  validateSchema(registerSchema),
  asyncHandler(async (req, res) => {
    const data = req.body;

    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new AppError('An account with this email already exists', 409);
    }

    let organization;
    let role = 'visitor';

    if (data.createOrganization) {
      if (!data.organizationName) {
        throw new AppError('organizationName is required when creating a new organization', 400);
      }
      const baseSlug = slugify(data.organizationSlug || data.organizationName);
      if (!baseSlug) {
        throw new AppError('Invalid organization name or slug', 400);
      }
      const existingOrg = await Organization.findOne({ slug: baseSlug });
      if (existingOrg) {
        throw new AppError(`Organization slug '${baseSlug}' is already taken`, 409);
      }
      organization = await Organization.create({
        name: data.organizationName,
        slug: baseSlug,
        industry: data.industry,
        locations: [
          {
            name: data.locationName || 'Main Campus',
            code: 'MAIN',
            gates: ['Main Reception'],
            isActive: true,
          },
        ],
      });
      role = 'admin';
    } else {
      if (data.organizationId) {
        organization = await Organization.findOne({ _id: data.organizationId, isActive: true });
      } else if (data.organizationSlug) {
        organization = await Organization.findOne({ slug: data.organizationSlug, isActive: true });
      } else {
        organization = await Organization.findOne({ isActive: true }).sort({ createdAt: 1 });
      }

      if (!organization) {
        throw new AppError('Target organization not found or inactive', 404);
      }
    }

    const otpCode = generateOtpCode();
    const otpCodeHash = await hashOtpCode(otpCode);
    const otpExpiresAt = getOtpExpiryDate();
    const passwordHash = await User.hashPassword(data.password);
    const resolvedLocation =
      data.locationName || organization.locations?.[0]?.name || 'Main Campus';

    const user = await User.create({
      organizationId: organization._id,
      locationName: resolvedLocation,
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role,
      department: role === 'admin' ? 'Administration' : 'External Guest',
      isVerified: false,
      otpCodeHash,
      otpExpiresAt,
    });

    if (role === 'visitor') {
      await Visitor.findOneAndUpdate(
        { organizationId: organization._id, email: data.email },
        {
          $set: {
            userId: user._id,
            fullName: data.name,
            phone: data.phone || 'Not provided',
            company: data.company || 'Independent',
            idType: data.idType,
            idNumber: data.idNumber || '',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    await sendEmailNotification({
      organizationId: organization._id,
      recipientUserId: user._id,
      to: user.email,
      subject: `Verify your ${organization.name} GatePass account`,
      message: `Your verification OTP code is ${otpCode}. It expires in 10 minutes.`,
      eventType: 'OTP_VERIFICATION',
    });

    if (user.phone) {
      await sendSmsNotification({
        organizationId: organization._id,
        recipientUserId: user._id,
        to: user.phone,
        message: `${organization.name} OTP: ${otpCode} (valid 10 mins).`,
        eventType: 'OTP_VERIFICATION',
      });
    }

    await recordAudit({
      organizationId: organization._id,
      actor: user,
      action: data.createOrganization ? 'ORGANIZATION_REGISTERED' : 'VISITOR_ACCOUNT_REGISTERED',
      entityType: 'User',
      entityId: user._id,
      metadata: { role: user.role, organizationSlug: organization.slug },
      ipAddress: getRequestIp(req),
    });

    const token = signAuthToken(user);

    res.status(201).json({
      success: true,
      token,
      user,
      organization,
      ...(env.isProduction || env.smtp.host ? {} : { devOtpPreview: otpCode }),
    });
  })
);

router.post(
  '/login',
  validateSchema(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Contact an administrator.', 403);
    }

    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    const organization = await Organization.findById(user.organizationId);
    if (!organization || !organization.isActive) {
      throw new AppError('Organization is inactive or unavailable', 403);
    }

    user.lastLoginAt = new Date();
    await user.save();

    await recordAudit({
      organizationId: organization._id,
      actor: user,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user._id,
      metadata: { role: user.role },
      ipAddress: getRequestIp(req),
    });

    const token = signAuthToken(user);

    res.json({
      success: true,
      token,
      user,
      organization,
    });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.organizationId);
    res.json({
      success: true,
      user: req.user,
      organization,
    });
  })
);

router.patch(
  '/me',
  authenticate,
  validateSchema(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const updates = req.body;
    Object.assign(req.user, updates);
    await req.user.save();

    if (req.user.role === 'visitor') {
      await Visitor.updateMany(
        { organizationId: req.organizationId, userId: req.user._id },
        {
          $set: {
            ...(updates.name ? { fullName: updates.name } : {}),
            ...(updates.phone ? { phone: updates.phone } : {}),
          },
        }
      );
    }

    res.json({
      success: true,
      user: req.user,
    });
  })
);

async function resolveUserForOtp(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new AppError('Invalid or expired authentication token', 401);
    }
    return User.findById(decoded.sub).select('+otpCodeHash +otpExpiresAt');
  }

  if (req.body.email) {
    return User.findOne({ email: req.body.email }).select('+otpCodeHash +otpExpiresAt');
  }

  return null;
}

router.post(
  '/send-otp',
  validateSchema(sendOtpSchema),
  asyncHandler(async (req, res) => {
    const user = await resolveUserForOtp(req);

    if (!user) {
      throw new AppError('User not found for OTP dispatch', 404);
    }

    const otpCode = generateOtpCode();
    user.otpCodeHash = await hashOtpCode(otpCode);
    user.otpExpiresAt = getOtpExpiryDate();
    await user.save();

    const channel = req.body.channel;
    if (channel === 'email' || channel === 'both') {
      await sendEmailNotification({
        organizationId: user.organizationId,
        recipientUserId: user._id,
        to: user.email,
        subject: 'Your GatePass OTP Verification Code',
        message: `Your 6-digit verification code is ${otpCode}. Valid for 10 minutes.`,
        eventType: 'OTP_VERIFICATION',
      });
    }

    if ((channel === 'sms' || channel === 'both') && user.phone) {
      await sendSmsNotification({
        organizationId: user.organizationId,
        recipientUserId: user._id,
        to: user.phone,
        message: `GatePass verification code: ${otpCode} (valid for 10 minutes).`,
        eventType: 'OTP_VERIFICATION',
      });
    }

    res.json({
      success: true,
      message: 'OTP dispatched successfully',
      expiresAt: user.otpExpiresAt,
      ...(env.isProduction || env.smtp.host ? {} : { devOtpPreview: otpCode }),
    });
  })
);

router.post(
  '/verify-otp',
  validateSchema(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const user = await resolveUserForOtp(req);

    if (!user) {
      throw new AppError('User account not found', 404);
    }

    const check = await verifyOtpCode(req.body.otp, user.otpCodeHash, user.otpExpiresAt);
    if (!check.valid) {
      throw new AppError(check.reason, 400);
    }

    user.isVerified = true;
    user.otpCodeHash = null;
    user.otpExpiresAt = null;
    await user.save();

    await recordAudit({
      organizationId: user.organizationId,
      actor: user,
      action: 'ACCOUNT_OTP_VERIFIED',
      entityType: 'User',
      entityId: user._id,
      ipAddress: getRequestIp(req),
    });

    res.json({
      success: true,
      message: 'Account verified successfully',
      user,
    });
  })
);

export default router;
