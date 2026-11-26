import express from 'express';
import { z } from 'zod';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { resolveUploadedPhotoUrl, uploadVisitorPhoto } from '../middleware/upload.js';
import {
  APPOINTMENT_CATEGORIES,
  Appointment,
  ID_TYPES,
  Organization,
  Pass,
  User,
  Visitor,
} from '../models/index.js';
import { getRequestIp, recordAudit } from '../services/auditService.js';
import { sendEmailNotification, sendSmsNotification } from '../services/notificationService.js';
import {
  ensurePassQrDataUrl,
  generateQrDataUrl,
  generateUniquePassCode,
  signQrToken,
} from '../services/passService.js';
import { buildVisitorPassPdfBuffer } from '../services/pdfBadgeService.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { validateSchema } from '../utils/validate.js';

const router = express.Router();

const issuePassSchema = z.object({
  appointmentId: z.string().trim().min(1),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  forceReissue: z.boolean().optional().default(false),
});

const walkInSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().min(5).max(30),
  company: z.string().trim().max(120).optional().default('Walk-In Guest'),
  idType: z.enum(ID_TYPES).optional().default('national_id'),
  idNumber: z.string().trim().max(60).optional().default(''),
  vehicleNumber: z.string().trim().max(30).optional().default(''),
  photoBase64: z.string().optional(),
  hostId: z.string().trim().min(1),
  locationName: z.string().trim().max(120).optional(),
  purpose: z.string().trim().min(3).max(300),
  category: z.enum(APPOINTMENT_CATEGORIES).optional().default('business_meeting'),
  durationHours: z.coerce.number().min(0.5).max(72).optional(),
});

const revokeSchema = z.object({
  reason: z.string().trim().min(2).max(300).optional().default('Revoked by security/admin'),
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

async function authorizePassView(pass, user) {
  if (['admin', 'security'].includes(user.role)) return true;
  if (user.role === 'host' && String(pass.hostId?._id || pass.hostId) === String(user._id)) {
    return true;
  }
  if (user.role === 'visitor') {
    const visitor = pass.visitorId?._id
      ? pass.visitorId
      : await Visitor.findById(pass.visitorId);
    if (
      visitor &&
      (String(visitor.userId) === String(user._id) || visitor.email === user.email)
    ) {
      return true;
    }
  }
  return false;
}

router.post(
  '/issue',
  authenticate,
  authorizeRoles('admin', 'security'),
  validateSchema(issuePassSchema),
  asyncHandler(async (req, res) => {
    const { appointmentId, validFrom, validUntil, forceReissue } = req.body;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      organizationId: req.organizationId,
    })
      .populate('visitorId')
      .populate('hostId', 'name email department locationName');

    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    if (appointment.visitorId?.isWatchlisted) {
      throw new AppError('Cannot issue pass for a watchlisted visitor', 403);
    }

    if (appointment.status !== 'approved') {
      throw new AppError(
        `Cannot issue pass for appointment with status '${appointment.status}'. Appointment must be approved first.`,
        400
      );
    }

    const existingActive = await Pass.findOne({
      appointmentId: appointment._id,
      status: { $in: ['active', 'checked_in'] },
    });

    if (existingActive && !forceReissue) {
      await ensurePassQrDataUrl(existingActive);
      return res.json({
        success: true,
        reused: true,
        pass: existingActive,
      });
    }

    if (existingActive && forceReissue) {
      existingActive.status = 'revoked';
      existingActive.revokedReason = 'Superseded by reissued pass';
      existingActive.revokedBy = req.user._id;
      existingActive.revokedAt = new Date();
      await existingActive.save();
    }

    const start = validFrom || appointment.scheduledStart;
    const end = validUntil || appointment.scheduledEnd;
    if (end <= start) {
      throw new AppError('Pass validUntil must be after validFrom', 400);
    }

    const passCode = await generateUniquePassCode();
    const qrToken = signQrToken(passCode, req.organizationId, appointment._id);
    const qrDataUrl = await generateQrDataUrl(qrToken);

    const pass = await Pass.create({
      organizationId: req.organizationId,
      locationName: appointment.locationName,
      appointmentId: appointment._id,
      visitorId: appointment.visitorId._id,
      hostId: appointment.hostId._id,
      issuedBy: req.user._id,
      passCode,
      qrToken,
      qrDataUrl,
      validFrom: start,
      validUntil: end,
      status: 'active',
    });

    const visitor = appointment.visitorId;
    if (visitor?.email) {
      await sendEmailNotification({
        organizationId: req.organizationId,
        recipientUserId: visitor.userId,
        to: visitor.email,
        subject: `Your Digital Visitor Pass (${pass.passCode})`,
        message: `Pass ${pass.passCode} has been issued for your visit with ${appointment.hostId?.name} at ${appointment.locationName}. Valid until ${end.toLocaleString()}.`,
        eventType: 'PASS_ISSUED',
      });
    }

    if (visitor?.phone) {
      await sendSmsNotification({
        organizationId: req.organizationId,
        recipientUserId: visitor.userId,
        to: visitor.phone,
        message: `Visitor Pass ${pass.passCode} is active for ${appointment.locationName}.`,
        eventType: 'PASS_ISSUED',
      });
    }

    await recordAudit({
      organizationId: req.organizationId,
      actor: req.user,
      action: 'PASS_ISSUED',
      entityType: 'Pass',
      entityId: pass._id,
      metadata: { passCode: pass.passCode, appointmentId: appointment._id },
      ipAddress: getRequestIp(req),
    });

    const populated = await Pass.findById(pass._id)
      .populate('visitorId', 'fullName email phone company photoUrl idType idNumber')
      .populate('hostId', 'name email department')
      .populate('appointmentId', 'purpose category scheduledStart scheduledEnd status requireOtp');

    res.status(201).json({
      success: true,
      pass: populated,
    });
  })
);

router.post(
  '/walk-in',
  authenticate,
  authorizeRoles('admin', 'security'),
  uploadVisitorPhoto.single('photo'),
  asyncHandler(async (req, res) => {
    const data = parseBody(walkInSchema, req.body);
    const photoUrl = resolveUploadedPhotoUrl(req);

    const [organization, host] = await Promise.all([
      Organization.findById(req.organizationId),
      User.findOne({
        _id: data.hostId,
        organizationId: req.organizationId,
        isActive: true,
      }),
    ]);

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }
    if (!host) {
      throw new AppError('Selected host not found in organization', 404);
    }

    let visitor = await Visitor.findOne({
      organizationId: req.organizationId,
      email: data.email,
    });

    if (visitor) {
      if (visitor.isWatchlisted) {
        throw new AppError(
          `Walk-in denied: visitor is watchlisted${visitor.watchlistReason ? ` (${visitor.watchlistReason})` : ''}`,
          403
        );
      }
      Object.assign(visitor, {
        fullName: data.fullName,
        phone: data.phone,
        company: data.company,
        idType: data.idType,
        idNumber: data.idNumber,
        vehicleNumber: data.vehicleNumber,
        ...(photoUrl ? { photoUrl } : {}),
      });
      await visitor.save();
    } else {
      visitor = await Visitor.create({
        organizationId: req.organizationId,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        idType: data.idType,
        idNumber: data.idNumber,
        vehicleNumber: data.vehicleNumber,
        photoUrl,
      });
    }

    const durationHours =
      data.durationHours || organization.settings?.defaultPassDurationHours || 8;
    const now = new Date();
    const validUntil = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    const locationName =
      data.locationName || req.user.locationName || organization.locations?.[0]?.name || 'Main Campus';

    const appointment = await Appointment.create({
      organizationId: req.organizationId,
      locationName,
      visitorId: visitor._id,
      hostId: host._id,
      createdBy: req.user._id,
      purpose: data.purpose,
      category: data.category,
      type: 'walk_in',
      scheduledStart: now,
      scheduledEnd: validUntil,
      status: 'approved',
      approvalNote: `Walk-in registered at desk by ${req.user.name}`,
      approvedBy: req.user._id,
      approvedAt: now,
      requireOtp: false,
    });

    const passCode = await generateUniquePassCode();
    const qrToken = signQrToken(passCode, req.organizationId, appointment._id);
    const qrDataUrl = await generateQrDataUrl(qrToken);

    const pass = await Pass.create({
      organizationId: req.organizationId,
      locationName,
      appointmentId: appointment._id,
      visitorId: visitor._id,
      hostId: host._id,
      issuedBy: req.user._id,
      passCode,
      qrToken,
      qrDataUrl,
      validFrom: now,
      validUntil,
      status: 'active',
    });

    await sendEmailNotification({
      organizationId: req.organizationId,
      recipientUserId: host._id,
      to: host.email,
      subject: `Walk-In Visitor Pass Issued: ${visitor.fullName}`,
      message: `${visitor.fullName} (${visitor.company}) registered at ${locationName} to meet you for "${data.purpose}". Pass: ${pass.passCode}.`,
      eventType: 'WALKIN_PASS_ISSUED',
    });

    await recordAudit({
      organizationId: req.organizationId,
      actor: req.user,
      action: 'WALKIN_PASS_ISSUED',
      entityType: 'Pass',
      entityId: pass._id,
      metadata: { passCode: pass.passCode, visitorEmail: visitor.email },
      ipAddress: getRequestIp(req),
    });

    const populatedPass = await Pass.findById(pass._id)
      .populate('visitorId')
      .populate('hostId', 'name email department')
      .populate('appointmentId');

    res.status(201).json({
      success: true,
      visitor,
      appointment,
      pass: populatedPass,
    });
  })
);

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { status, locationName, search, page = '1', limit = '25' } = req.query;
    const filter = { organizationId: req.organizationId };

    if (req.user.role === 'visitor') {
      const myVisitors = await Visitor.find({
        organizationId: req.organizationId,
        $or: [{ userId: req.user._id }, { email: req.user.email }],
      }).select('_id');
      filter.visitorId = { $in: myVisitors.map((v) => v._id) };
    } else if (req.user.role === 'host') {
      filter.hostId = req.user._id;
    }

    if (status) filter.status = status;
    if (locationName) filter.locationName = locationName;

    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      const matchingVisitors = await Visitor.find({
        organizationId: req.organizationId,
        $or: [{ fullName: regex }, { email: regex }, { company: regex }],
      }).select('_id');
      filter.$or = [
        { passCode: regex },
        { visitorId: { $in: matchingVisitors.map((v) => v._id) } },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));

    const [passes, total] = await Promise.all([
      Pass.find(filter)
        .populate('visitorId', 'fullName email phone company photoUrl idType idNumber isWatchlisted')
        .populate('hostId', 'name email department locationName')
        .populate('appointmentId', 'purpose category scheduledStart scheduledEnd status requireOtp')
        .populate('issuedBy', 'name role')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Pass.countDocuments(filter),
    ]);

    await Promise.all(passes.map((p) => ensurePassQrDataUrl(p)));

    res.json({
      success: true,
      passes,
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
    const pass = await Pass.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    })
      .populate('visitorId')
      .populate('hostId', 'name email department locationName')
      .populate('appointmentId')
      .populate('issuedBy', 'name role');

    if (!pass) {
      throw new AppError('Pass not found', 404);
    }

    if (!(await authorizePassView(pass, req.user))) {
      throw new AppError('Access denied to this visitor pass', 403);
    }

    await ensurePassQrDataUrl(pass);

    res.json({
      success: true,
      pass,
    });
  })
);

router.get(
  '/:id/pdf',
  authenticate,
  asyncHandler(async (req, res) => {
    const pass = await Pass.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    })
      .populate('visitorId')
      .populate('hostId', 'name email department locationName')
      .populate('appointmentId');

    if (!pass) {
      throw new AppError('Pass not found', 404);
    }

    if (!(await authorizePassView(pass, req.user))) {
      throw new AppError('Access denied to download this visitor pass PDF', 403);
    }

    const organization = await Organization.findById(req.organizationId);
    const pdfBuffer = await buildVisitorPassPdfBuffer({
      pass,
      visitor: pass.visitorId,
      host: pass.hostId,
      appointment: pass.appointmentId,
      organization,
    });

    const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="badge-${pass.passCode}.pdf"`);
    res.send(pdfBuffer);
  })
);

router.patch(
  '/:id/revoke',
  authenticate,
  authorizeRoles('admin', 'security'),
  validateSchema(revokeSchema),
  asyncHandler(async (req, res) => {
    const pass = await Pass.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    }).populate('visitorId');

    if (!pass) {
      throw new AppError('Pass not found', 404);
    }

    if (['revoked', 'used'].includes(pass.status)) {
      throw new AppError(`Pass cannot be revoked from '${pass.status}' status`, 400);
    }

    pass.status = 'revoked';
    pass.revokedReason = req.body.reason;
    pass.revokedBy = req.user._id;
    pass.revokedAt = new Date();
    await pass.save();

    if (pass.visitorId?.email) {
      await sendEmailNotification({
        organizationId: req.organizationId,
        recipientUserId: pass.visitorId.userId,
        to: pass.visitorId.email,
        subject: `Visitor Pass ${pass.passCode} Revoked`,
        message: `Your visitor pass ${pass.passCode} has been revoked. Reason: ${pass.revokedReason}`,
        eventType: 'PASS_REVOKED',
      });
    }

    await recordAudit({
      organizationId: req.organizationId,
      actor: req.user,
      action: 'PASS_REVOKED',
      entityType: 'Pass',
      entityId: pass._id,
      metadata: { passCode: pass.passCode, reason: pass.revokedReason },
      ipAddress: getRequestIp(req),
    });

    res.json({
      success: true,
      pass,
    });
  })
);

export default router;
