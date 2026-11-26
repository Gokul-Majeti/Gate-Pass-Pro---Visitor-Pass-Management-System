import express from 'express';
import { z } from 'zod';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { resolveUploadedPhotoUrl, uploadVisitorPhoto } from '../middleware/upload.js';
import { Appointment, ID_TYPES, Visitor } from '../models/index.js';
import { getRequestIp, recordAudit } from '../services/auditService.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = express.Router();

const visitorBodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().min(5).max(30),
  company: z.string().trim().max(120).optional().default('Independent'),
  idType: z.enum(ID_TYPES).optional().default('national_id'),
  idNumber: z.string().trim().max(60).optional().default(''),
  vehicleNumber: z.string().trim().max(30).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
  photoBase64: z.string().optional(),
});

const visitorUpdateSchema = visitorBodySchema.partial().extend({
  isWatchlisted: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v),
    z.boolean().optional()
  ),
  watchlistReason: z.string().trim().max(300).optional(),
});

function parseBody(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    throw new AppError('Validation failed', 400, details);
  }
  return parsed.data;
}

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    let visitor = await Visitor.findOne({
      organizationId: req.organizationId,
      $or: [{ userId: req.user._id }, { email: req.user.email }],
    });

    if (!visitor && req.user.role === 'visitor') {
      visitor = await Visitor.create({
        organizationId: req.organizationId,
        userId: req.user._id,
        fullName: req.user.name,
        email: req.user.email,
        phone: req.user.phone || 'Not provided',
        company: 'Independent',
      });
    }

    res.json({
      success: true,
      visitor,
    });
  })
);

router.get(
  '/',
  authenticate,
  authorizeRoles('admin', 'security', 'host'),
  asyncHandler(async (req, res) => {
    const { search, isWatchlisted, page = '1', limit = '25' } = req.query;
    const filter = { organizationId: req.organizationId };

    if (isWatchlisted !== undefined) {
      filter.isWatchlisted = isWatchlisted === 'true';
    }
    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { company: regex },
        { idNumber: regex },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));

    const [visitors, total] = await Promise.all([
      Visitor.find(filter)
        .sort({ updatedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Visitor.countDocuments(filter),
    ]);

    res.json({
      success: true,
      visitors,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  })
);

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const visitor = await Visitor.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    });

    if (!visitor) {
      throw new AppError('Visitor not found', 404);
    }

    if (
      req.user.role === 'visitor' &&
      String(visitor.userId) !== String(req.user._id) &&
      visitor.email !== req.user.email
    ) {
      throw new AppError('Access denied to another visitor profile', 403);
    }

    const recentAppointments = await Appointment.find({
      organizationId: req.organizationId,
      visitorId: visitor._id,
    })
      .populate('hostId', 'name email department locationName')
      .sort({ scheduledStart: -1 })
      .limit(10);

    res.json({
      success: true,
      visitor,
      recentAppointments,
    });
  })
);

router.post(
  '/',
  authenticate,
  uploadVisitorPhoto.single('photo'),
  asyncHandler(async (req, res) => {
    const data = parseBody(visitorBodySchema, req.body);
    const photoUrl = resolveUploadedPhotoUrl(req);

    if (req.user.role === 'visitor' && data.email !== req.user.email) {
      throw new AppError('Visitors may only register or update their own email profile', 403);
    }

    const existing = await Visitor.findOne({
      organizationId: req.organizationId,
      email: data.email,
    });

    let visitor;
    let action;

    if (existing) {
      Object.assign(existing, {
        fullName: data.fullName,
        phone: data.phone,
        company: data.company,
        idType: data.idType,
        idNumber: data.idNumber,
        vehicleNumber: data.vehicleNumber,
        notes: data.notes,
        ...(photoUrl ? { photoUrl } : {}),
        ...(req.user.role === 'visitor' && !existing.userId ? { userId: req.user._id } : {}),
      });
      visitor = await existing.save();
      action = 'VISITOR_UPDATED';
    } else {
      visitor = await Visitor.create({
        organizationId: req.organizationId,
        userId: req.user.role === 'visitor' ? req.user._id : null,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        idType: data.idType,
        idNumber: data.idNumber,
        vehicleNumber: data.vehicleNumber,
        notes: data.notes,
        photoUrl,
      });
      action = 'VISITOR_REGISTERED';
    }

    await recordAudit({
      organizationId: req.organizationId,
      actor: req.user,
      action,
      entityType: 'Visitor',
      entityId: visitor._id,
      metadata: { email: visitor.email, hasPhoto: Boolean(visitor.photoUrl) },
      ipAddress: getRequestIp(req),
    });

    res.status(existing ? 200 : 201).json({
      success: true,
      visitor,
    });
  })
);

router.patch(
  '/:id',
  authenticate,
  uploadVisitorPhoto.single('photo'),
  asyncHandler(async (req, res) => {
    const data = parseBody(visitorUpdateSchema, req.body);
    const visitor = await Visitor.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    });

    if (!visitor) {
      throw new AppError('Visitor not found', 404);
    }

    const isOwnerVisitor =
      req.user.role === 'visitor' &&
      (String(visitor.userId) === String(req.user._id) || visitor.email === req.user.email);

    if (!['admin', 'security'].includes(req.user.role) && !isOwnerVisitor) {
      throw new AppError('You do not have permission to edit this visitor profile', 403);
    }

    if (
      (data.isWatchlisted !== undefined || data.watchlistReason !== undefined) &&
      !['admin', 'security'].includes(req.user.role)
    ) {
      throw new AppError('Only Admin or Security staff can modify watchlist status', 403);
    }

    const photoUrl = resolveUploadedPhotoUrl(req);
    const { photoBase64: _ignored, ...safeUpdates } = data;
    Object.assign(visitor, safeUpdates);
    if (photoUrl) {
      visitor.photoUrl = photoUrl;
    }

    await visitor.save();

    await recordAudit({
      organizationId: req.organizationId,
      actor: req.user,
      action:
        data.isWatchlisted !== undefined ? 'VISITOR_WATCHLIST_UPDATED' : 'VISITOR_UPDATED',
      entityType: 'Visitor',
      entityId: visitor._id,
      metadata: safeUpdates,
      ipAddress: getRequestIp(req),
    });

    res.json({
      success: true,
      visitor,
    });
  })
);

export default router;
