import express from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { resolveUploadedPhotoUrl, uploadVisitorPhoto } from '../middleware/upload.js';
import {
  APPOINTMENT_CATEGORIES,
  Appointment,
  CheckLog,
  ID_TYPES,
  Organization,
  Pass,
  User,
  Visitor,
} from '../models/index.js';
import { getRequestIp, recordAudit } from '../services/auditService.js';
import { sendEmailNotification, sendSmsNotification } from '../services/notificationService.js';
import { generateOtpCode, hashOtpCode } from '../services/otpService.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = express.Router();

const preRegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  phone: z.string().trim().min(5).max(30).optional(),
  company: z.string().trim().max(120).optional().default('Independent'),
  idType: z.enum(ID_TYPES).optional().default('national_id'),
  idNumber: z.string().trim().max(60).optional().default(''),
  vehicleNumber: z.string().trim().max(30).optional().default(''),
  photoBase64: z.string().optional(),
  hostId: z.string().trim().min(1, 'Host is required'),
  locationName: z.string().trim().min(1).max(120).optional(),
  purpose: z.string().trim().min(3).max(300),
  category: z.enum(APPOINTMENT_CATEGORIES).optional().default('business_meeting'),
  scheduledStart: z.coerce.date(),
  scheduledEnd: z.coerce.date(),
});

const inviteSchema = z.object({
  visitorId: z.string().trim().optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  phone: z.string().trim().min(5).max(30).optional(),
  company: z.string().trim().max(120).optional().default('Independent'),
  idType: z.enum(ID_TYPES).optional().default('national_id'),
  idNumber: z.string().trim().max(60).optional().default(''),
  vehicleNumber: z.string().trim().max(30).optional().default(''),
  photoBase64: z.string().optional(),
  hostId: z.string().trim().optional(),
  locationName: z.string().trim().min(1).max(120).optional(),
  purpose: z.string().trim().min(3).max(300),
  category: z.enum(APPOINTMENT_CATEGORIES).optional().default('business_meeting'),
  scheduledStart: z.coerce.date(),
  scheduledEnd: z.coerce.date(),
  requireOtp: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v),
    z.boolean().optional()
  ),
  approvalNote: z.string().trim().max(300).optional().default(''),
});

const statusUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled']),
  approvalNote: z.string().trim().max(300).optional().default(''),
  requireOtp: z.boolean().optional(),
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

async function issueGateOtpIfNeeded(appointment, organization, visitor) {
  const mustUseOtp = Boolean(appointment.requireOtp || organization?.settings?.requireOtpAtGate);
  if (!mustUseOtp) return null;

  const otpCode = generateOtpCode();
  appointment.requireOtp = true;
  appointment.gateOtpHash = await hashOtpCode(otpCode);
  appointment.gateOtpExpiresAt = new Date(
    Math.max(appointment.scheduledEnd.getTime(), Date.now() + 60 * 60 * 1000)
  );
  appointment.otpVerified = false;
  await appointment.save();

  await sendEmailNotification({
    organizationId: organization._id,
    recipientUserId: visitor.userId,
    to: visitor.email,
    subject: `Gate Verification OTP for ${organization.name}`,
    message: `Present OTP ${otpCode} at ${appointment.locationName} security desk if requested during check-in.`,
    eventType: 'GATE_OTP_ISSUED',
  });

  if (visitor.phone) {
    await sendSmsNotification({
      organizationId: organization._id,
      recipientUserId: visitor.userId,
      to: visitor.phone,
      message: `${organization.name} gate check-in OTP: ${otpCode}`,
      eventType: 'GATE_OTP_ISSUED',
    });
  }

  return otpCode;
}

async function upsertVisitorProfile({ organizationId, user, data, photoUrl, linkSelfUser = false }) {
  const email = (data.email || user.email).toLowerCase();
  const fullName = data.fullName || user.name;
  const phone = data.phone || user.phone || 'Not provided';

  let visitor = await Visitor.findOne({ organizationId, email });
  if (visitor) {
    if (visitor.isWatchlisted) {
      throw new AppError(
        `Visitor is on the security watchlist${visitor.watchlistReason ? `: ${visitor.watchlistReason}` : ''}`,
        403
      );
    }
    Object.assign(visitor, {
      fullName,
      phone,
      company: data.company || visitor.company,
      idType: data.idType || visitor.idType,
      idNumber: data.idNumber !== undefined ? data.idNumber : visitor.idNumber,
      vehicleNumber: data.vehicleNumber !== undefined ? data.vehicleNumber : visitor.vehicleNumber,
      ...(photoUrl ? { photoUrl } : {}),
      ...(linkSelfUser && !visitor.userId ? { userId: user._id } : {}),
    });
    return visitor.save();
  }

  return Visitor.create({
    organizationId,
    userId: linkSelfUser ? user._id : null,
    fullName,
    email,
    phone,
    company: data.company || 'Independent',
    idType: data.idType || 'national_id',
    idNumber: data.idNumber || '',
    vehicleNumber: data.vehicleNumber || '',
    photoUrl,
  });
}

router.post(
  '/pre-register',
  authenticate,
  uploadVisitorPhoto.single('photo'),
  asyncHandler(async (req, res) => {
    const data = parseBody(preRegisterSchema, req.body);
    if (data.scheduledEnd <= data.scheduledStart) {
      throw new AppError('scheduledEnd must be after scheduledStart', 400);
    }

    const photoUrl = resolveUploadedPhotoUrl(req);
    const organization = await Organization.findById(req.organizationId);
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    const host = await User.findOne({
      _id: data.hostId,
      organizationId: req.organizationId,
      role: { $in: ['host', 'admin'] },
      isActive: true,
    });
    if (!host) {
      throw new AppError('Selected host not found in this organization', 404);
    }

    if (req.user.role === 'visitor' && data.email && data.email !== req.user.email) {
      throw new AppError('Visitors may only pre-register using their own email', 403);
    }

    const visitor = await upsertVisitorProfile({
      organizationId: req.organizationId,
      user: req.user,
      data,
      photoUrl,
      linkSelfUser: req.user.role === 'visitor',
    });

    const autoApprove = organization.settings?.requireHostApproval === false;
    const locationName = data.locationName || host.locationName || organization.locations?.[0]?.name || 'Main Campus';

    const appointment = await Appointment.create({
      organizationId: req.organizationId,
      locationName,
      visitorId: visitor._id,
      hostId: host._id,
      createdBy: req.user._id,
      purpose: data.purpose,
      category: data.category,
      type: 'pre_registered',
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      status: autoApprove ? 'approved' : 'pending',
      approvedBy: autoApprove ? host._id : null,
      approvedAt: autoApprove ? new Date() : null,
      requireOtp: Boolean(organization.settings?.requireOtpAtGate),
    });

    let devGateOtpPreview = null;
    if (autoApprove) {
      devGateOtpPreview = await issueGateOtpIfNeeded(appointment, organization, visitor);
    }

    await sendEmailNotification({
      organizationId: req.organizationId,
      recipientUserId: host._id,
      to: host.email,
      subject: `Visitor Pre-Registration: ${visitor.fullName} (${visitor.company})`,
      message: `${visitor.fullName} requested a visit at ${locationName} for "${data.purpose}" starting ${data.scheduledStart.toISOString()}.`,
      eventType: 'PRE_REGISTRATION_REQUEST',
    });

    await sendEmailNotification({
      organizationId: req.organizationId,
      recipientUserId: visitor.userId,
      to: visitor.email,
      subject: `Pre-Registration ${autoApprove ? 'Approved' : 'Submitted'}: ${organization.name}`,
      message: autoApprove
        ? `Your visit with ${host.name} at ${locationName} is approved.`
        : `Your visit request with ${host.name} at ${locationName} is pending host approval.`,
      eventType: autoApprove ? 'APPOINTMENT_APPROVED' : 'PRE_REGISTRATION_SUBMITTED',
    });

    await recordAudit({
      organizationId: req.organizationId,
      actor: req.user,
      action: 'APPOINTMENT_PRE_REGISTERED',
      entityType: 'Appointment',
      entityId: appointment._id,
      metadata: {
        visitorName: visitor.fullName,
        hostName: host.name,
        status: appointment.status,
      },
      ipAddress: getRequestIp(req),
    });

    const populated = await Appointment.findById(appointment._id)
      .populate('visitorId')
      .populate('hostId', 'name email department locationName');

    res.status(201).json({
      success: true,
      appointment: populated,
      ...(devGateOtpPreview && !env.isProduction && !env.smtp.host ? { devGateOtpPreview } : {}),
    });
  })
);

router.post(
  '/invite',
  authenticate,
  authorizeRoles('host', 'admin', 'security'),
  uploadVisitorPhoto.single('photo'),
  asyncHandler(async (req, res) => {
    const data = parseBody(inviteSchema, req.body);
    if (data.scheduledEnd <= data.scheduledStart) {
      throw new AppError('scheduledEnd must be after scheduledStart', 400);
    }

    const organization = await Organization.findById(req.organizationId);
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    const resolvedHostId =
      req.user.role === 'host' ? req.user._id : data.hostId || req.user._id;
    const host = await User.findOne({
      _id: resolvedHostId,
      organizationId: req.organizationId,
      isActive: true,
    });
    if (!host) {
      throw new AppError('Assigned host not found in organization', 404);
    }

    const photoUrl = resolveUploadedPhotoUrl(req);
    let visitor;

    if (data.visitorId) {
      visitor = await Visitor.findOne({
        _id: data.visitorId,
        organizationId: req.organizationId,
      });
      if (!visitor) {
        throw new AppError('Referenced visitor not found', 404);
      }
      if (visitor.isWatchlisted) {
        throw new AppError('Visitor is currently watchlisted', 403);
      }
      if (photoUrl) {
        visitor.photoUrl = photoUrl;
        await visitor.save();
      }
    } else {
      if (!data.fullName || !data.email || !data.phone) {
        throw new AppError('fullName, email, and phone are required to invite a new visitor', 400);
      }
      visitor = await upsertVisitorProfile({
        organizationId: req.organizationId,
        user: req.user,
        data,
        photoUrl,
      });
    }

    const locationName =
      data.locationName || host.locationName || organization.locations?.[0]?.name || 'Main Campus';
    const requireOtp =
      data.requireOtp !== undefined
        ? data.requireOtp
        : Boolean(organization.settings?.requireOtpAtGate);

    const appointment = await Appointment.create({
      organizationId: req.organizationId,
      locationName,
      visitorId: visitor._id,
      hostId: host._id,
      createdBy: req.user._id,
      purpose: data.purpose,
      category: data.category,
      type: req.user.role === 'security' ? 'walk_in' : 'host_invited',
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      status: 'approved',
      approvalNote: data.approvalNote || `Invited by ${req.user.name}`,
      approvedBy: req.user._id,
      approvedAt: new Date(),
      requireOtp,
    });

    const devGateOtpPreview = await issueGateOtpIfNeeded(appointment, organization, visitor);

    await sendEmailNotification({
      organizationId: req.organizationId,
      recipientUserId: visitor.userId,
      to: visitor.email,
      subject: `Visitor Invitation from ${organization.name}`,
      message: `Hello ${visitor.fullName}, ${host.name} invited you to ${organization.name} (${locationName}) for "${data.purpose}" on ${data.scheduledStart.toLocaleString()}.`,
      eventType: 'APPOINTMENT_INVITED',
    });

    if (visitor.phone) {
      await sendSmsNotification({
        organizationId: req.organizationId,
        recipientUserId: visitor.userId,
        to: visitor.phone,
        message: `${organization.name}: You are invited by ${host.name} at ${locationName} (${data.scheduledStart.toLocaleDateString()}).`,
        eventType: 'APPOINTMENT_INVITED',
      });
    }

    await recordAudit({
      organizationId: req.organizationId,
      actor: req.user,
      action: 'APPOINTMENT_INVITED',
      entityType: 'Appointment',
      entityId: appointment._id,
      metadata: {
        visitorEmail: visitor.email,
        hostName: host.name,
        type: appointment.type,
      },
      ipAddress: getRequestIp(req),
    });

    const populated = await Appointment.findById(appointment._id)
      .populate('visitorId')
      .populate('hostId', 'name email department locationName');

    res.status(201).json({
      success: true,
      appointment: populated,
      ...(devGateOtpPreview && !env.isProduction && !env.smtp.host ? { devGateOtpPreview } : {}),
    });
  })
);

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { status, type, locationName, hostId, search, from, to, page = '1', limit = '25' } =
      req.query;

    const filter = { organizationId: req.organizationId };

    if (req.user.role === 'visitor') {
      const myVisitors = await Visitor.find({
        organizationId: req.organizationId,
        $or: [{ userId: req.user._id }, { email: req.user.email }],
      }).select('_id');
      filter.visitorId = { $in: myVisitors.map((v) => v._id) };
    } else if (req.user.role === 'host') {
      filter.$or = [{ hostId: req.user._id }, { createdBy: req.user._id }];
    } else if (hostId) {
      filter.hostId = hostId;
    }

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (locationName) filter.locationName = locationName;

    if (from || to) {
      filter.scheduledStart = {};
      if (from) filter.scheduledStart.$gte = new Date(from);
      if (to) filter.scheduledStart.$lte = new Date(to);
    }

    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      const matchingVisitors = await Visitor.find({
        organizationId: req.organizationId,
        $or: [{ fullName: regex }, { email: regex }, { company: regex }],
      }).select('_id');
      const searchCond = [
        { purpose: regex },
        { visitorId: { $in: matchingVisitors.map((v) => v._id) } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchCond }];
        delete filter.$or;
      } else {
        filter.$or = searchCond;
      }
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .populate('visitorId', 'fullName email phone company idType idNumber photoUrl isWatchlisted')
        .populate('hostId', 'name email department locationName')
        .populate('approvedBy', 'name role')
        .sort({ scheduledStart: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    const appointmentIds = appointments.map((a) => a._id);
    const passes = await Pass.find({
      organizationId: req.organizationId,
      appointmentId: { $in: appointmentIds },
    })
      .select('appointmentId passCode status validFrom validUntil qrDataUrl')
      .sort({ createdAt: -1 })
      .lean();

    const passByAppointment = new Map();
    for (const pass of passes) {
      const key = String(pass.appointmentId);
      if (!passByAppointment.has(key)) {
        passByAppointment.set(key, pass);
      }
    }

    const enriched = appointments.map((apt) => ({
      ...apt,
      pass: passByAppointment.get(String(apt._id)) || null,
    }));

    res.json({
      success: true,
      appointments: enriched,
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
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    })
      .populate('visitorId')
      .populate('hostId', 'name email department locationName')
      .populate('approvedBy', 'name role');

    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    const isVisitorOwner =
      req.user.role === 'visitor' &&
      (String(appointment.visitorId?.userId) === String(req.user._id) ||
        appointment.visitorId?.email === req.user.email);
    const isHostOwner =
      req.user.role === 'host' &&
      (String(appointment.hostId?._id) === String(req.user._id) ||
        String(appointment.createdBy) === String(req.user._id));

    if (!['admin', 'security'].includes(req.user.role) && !isVisitorOwner && !isHostOwner) {
      throw new AppError('Access denied to this appointment', 403);
    }

    const [pass, checkLogs] = await Promise.all([
      Pass.findOne({ appointmentId: appointment._id }).sort({ createdAt: -1 }),
      CheckLog.find({ appointmentId: appointment._id })
        .populate('scannedBy', 'name role')
        .sort({ timestamp: -1 }),
    ]);

    res.json({
      success: true,
      appointment,
      pass,
      checkLogs,
    });
  })
);

router.patch(
  '/:id/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const data = parseBody(statusUpdateSchema, req.body);

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    })
      .populate('visitorId')
      .populate('hostId', 'name email department');

    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    const isAssignedHost =
      req.user.role === 'host' && String(appointment.hostId?._id) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    const isVisitorOwner =
      req.user.role === 'visitor' &&
      (String(appointment.visitorId?.userId) === String(req.user._id) ||
        appointment.visitorId?.email === req.user.email);

    if (data.status === 'cancelled') {
      if (!isAdmin && !isAssignedHost && !isVisitorOwner) {
        throw new AppError('You cannot cancel this appointment', 403);
      }
      if (!['pending', 'approved'].includes(appointment.status)) {
        throw new AppError(`Cannot cancel appointment in '${appointment.status}' state`, 400);
      }
    } else {
      if (!isAdmin && !isAssignedHost) {
        throw new AppError('Only the assigned Host or Admin can approve or reject appointments', 403);
      }
      if (appointment.status !== 'pending') {
        throw new AppError(`Appointment is already '${appointment.status}'`, 400);
      }
    }

    appointment.status = data.status;
    appointment.approvalNote = data.approvalNote || appointment.approvalNote;
    if (data.status === 'approved' || data.status === 'rejected') {
      appointment.approvedBy = req.user._id;
      appointment.approvedAt = new Date();
    }
    if (data.requireOtp !== undefined) {
      appointment.requireOtp = data.requireOtp;
    }

    await appointment.save();

    let devGateOtpPreview = null;
    if (data.status === 'approved') {
      const organization = await Organization.findById(req.organizationId);
      devGateOtpPreview = await issueGateOtpIfNeeded(
        appointment,
        organization,
        appointment.visitorId
      );
    }

    if (data.status === 'cancelled') {
      await Pass.updateMany(
        { appointmentId: appointment._id, status: 'active' },
        { $set: { status: 'revoked', revokedReason: 'Appointment cancelled', revokedAt: new Date(), revokedBy: req.user._id } }
      );
    }

    const visitor = appointment.visitorId;
    if (visitor?.email) {
      await sendEmailNotification({
        organizationId: req.organizationId,
        recipientUserId: visitor.userId,
        to: visitor.email,
        subject: `Visit Request ${data.status.toUpperCase()}`,
        message: `Your visit for "${appointment.purpose}" at ${appointment.locationName} was ${data.status}.${data.approvalNote ? ` Note: ${data.approvalNote}` : ''}`,
        eventType: `APPOINTMENT_${data.status.toUpperCase()}`,
      });
    }

    if (visitor?.phone && ['approved', 'rejected'].includes(data.status)) {
      await sendSmsNotification({
        organizationId: req.organizationId,
        recipientUserId: visitor.userId,
        to: visitor.phone,
        message: `Your visit at ${appointment.locationName} has been ${data.status}.`,
        eventType: `APPOINTMENT_${data.status.toUpperCase()}`,
      });
    }

    await recordAudit({
      organizationId: req.organizationId,
      actor: req.user,
      action: `APPOINTMENT_${data.status.toUpperCase()}`,
      entityType: 'Appointment',
      entityId: appointment._id,
      metadata: { approvalNote: data.approvalNote },
      ipAddress: getRequestIp(req),
    });

    res.json({
      success: true,
      appointment,
      ...(devGateOtpPreview && !env.isProduction && !env.smtp.host ? { devGateOtpPreview } : {}),
    });
  })
);

router.post(
  '/:id/send-gate-otp',
  authenticate,
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
    }).populate('visitorId');

    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }
    if (!['approved', 'checked_in'].includes(appointment.status)) {
      throw new AppError('Gate OTP can only be issued for approved appointments', 400);
    }

    const isVisitorOwner =
      req.user.role === 'visitor' &&
      (String(appointment.visitorId?.userId) === String(req.user._id) ||
        appointment.visitorId?.email === req.user.email);
    const isHostOwner =
      req.user.role === 'host' && String(appointment.hostId) === String(req.user._id);

    if (!['admin', 'security'].includes(req.user.role) && !isHostOwner && !isVisitorOwner) {
      throw new AppError('Not permitted to request gate OTP for this appointment', 403);
    }

    appointment.requireOtp = true;
    const organization = await Organization.findById(req.organizationId);
    const devGateOtpPreview = await issueGateOtpIfNeeded(
      appointment,
      organization,
      appointment.visitorId
    );

    res.json({
      success: true,
      message: 'Gate OTP sent to visitor email and phone',
      ...(devGateOtpPreview && !env.isProduction && !env.smtp.host ? { devGateOtpPreview } : {}),
    });
  })
);

export default router;
