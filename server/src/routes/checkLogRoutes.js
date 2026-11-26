import express from 'express';
import { z } from 'zod';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { Appointment, CheckLog, Pass, Visitor } from '../models/index.js';
import { getRequestIp, recordAudit } from '../services/auditService.js';
import { sendEmailNotification, sendSmsNotification } from '../services/notificationService.js';
import { verifyOtpCode } from '../services/otpService.js';
import { parseScannedPayload, verifyPassQrSignature } from '../services/passService.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { validateSchema } from '../utils/validate.js';

const router = express.Router();

const verifyInputSchema = z.object({
  qrToken: z.string().trim().optional(),
  passCode: z.string().trim().optional(),
  action: z.enum(['auto', 'check_in', 'check_out']).optional().default('auto'),
});

const scanSchema = z.object({
  qrToken: z.string().trim().optional(),
  passCode: z.string().trim().optional(),
  action: z.enum(['auto', 'check_in', 'check_out']).optional().default('auto'),
  method: z.enum(['qr_scan', 'manual_code', 'otp_fallback']).optional(),
  gateName: z.string().trim().max(100).optional().default('Main Reception'),
  otpCode: z.string().trim().optional(),
  notes: z.string().trim().max(300).optional().default(''),
});

const CHECKIN_EARLY_GRACE_MS = 60 * 60 * 1000; // Allow arriving up to 60 minutes early

async function evaluatePass({ rawInput, organizationId, requestedAction = 'auto' }) {
  const parsed = parseScannedPayload(rawInput);

  const pass = await Pass.findOne({
    organizationId,
    passCode: parsed.passCode,
  })
    .populate('visitorId')
    .populate('hostId', 'name email phone department locationName')
    .populate('appointmentId');

  if (!pass) {
    return {
      valid: false,
      statusCode: 404,
      reason: `No visitor pass found for code '${parsed.passCode}'`,
      parsed,
      pass: null,
    };
  }

  if (parsed.isSignedQr && !verifyPassQrSignature(pass, parsed.signature)) {
    return {
      valid: false,
      statusCode: 403,
      reason: 'QR signature verification failed (tampered or invalid QR payload)',
      parsed,
      pass,
    };
  }

  if (pass.visitorId?.isWatchlisted) {
    return {
      valid: false,
      statusCode: 403,
      reason: `Security alert: visitor is watchlisted${pass.visitorId.watchlistReason ? ` (${pass.visitorId.watchlistReason})` : ''}`,
      parsed,
      pass,
    };
  }

  if (pass.status === 'revoked') {
    return {
      valid: false,
      statusCode: 400,
      reason: `Pass ${pass.passCode} was revoked${pass.revokedReason ? `: ${pass.revokedReason}` : ''}`,
      parsed,
      pass,
    };
  }

  if (pass.status === 'used') {
    return {
      valid: false,
      statusCode: 400,
      reason: `Pass ${pass.passCode} has already completed check-out`,
      parsed,
      pass,
    };
  }

  if (pass.status === 'expired') {
    return {
      valid: false,
      statusCode: 400,
      reason: `Pass ${pass.passCode} is expired`,
      parsed,
      pass,
    };
  }

  const recommendedAction = pass.status === 'checked_in' ? 'check_out' : 'check_in';
  const resolvedAction = requestedAction === 'auto' ? recommendedAction : requestedAction;

  if (resolvedAction === 'check_in' && pass.status === 'checked_in') {
    return {
      valid: false,
      statusCode: 400,
      reason: `Pass ${pass.passCode} is already checked in`,
      parsed,
      pass,
    };
  }

  if (resolvedAction === 'check_out' && pass.status !== 'checked_in') {
    return {
      valid: false,
      statusCode: 400,
      reason: `Cannot check out pass ${pass.passCode} because visitor has not checked in yet`,
      parsed,
      pass,
    };
  }

  const now = Date.now();
  const validFromMs = new Date(pass.validFrom).getTime();
  const validUntilMs = new Date(pass.validUntil).getTime();

  if (resolvedAction === 'check_in') {
    if (now < validFromMs - CHECKIN_EARLY_GRACE_MS) {
      return {
        valid: false,
        statusCode: 400,
        reason: `Pass is not active yet (valid from ${new Date(pass.validFrom).toLocaleString()})`,
        parsed,
        pass,
      };
    }
    if (now > validUntilMs) {
      pass.status = 'expired';
      await pass.save();
      return {
        valid: false,
        statusCode: 400,
        reason: `Pass ${pass.passCode} expired at ${new Date(pass.validUntil).toLocaleString()}`,
        parsed,
        pass,
      };
    }
  }

  return {
    valid: true,
    statusCode: 200,
    parsed,
    pass,
    resolvedAction,
    recommendedAction,
    overstay: resolvedAction === 'check_out' && now > validUntilMs,
  };
}

router.post(
  '/verify',
  authenticate,
  authorizeRoles('admin', 'security'),
  validateSchema(verifyInputSchema),
  asyncHandler(async (req, res) => {
    const rawInput = req.body.qrToken || req.body.passCode;
    if (!rawInput) {
      throw new AppError('Provide qrToken or passCode to verify', 400);
    }

    const evaluation = await evaluatePass({
      rawInput,
      organizationId: req.organizationId,
      requestedAction: req.body.action,
    });

    res.json({
      success: true,
      valid: evaluation.valid,
      reason: evaluation.reason || null,
      recommendedAction: evaluation.recommendedAction || null,
      overstay: Boolean(evaluation.overstay),
      requireGateOtp: Boolean(
        evaluation.pass?.appointmentId?.requireOtp && !evaluation.pass?.appointmentId?.otpVerified
      ),
      pass: evaluation.pass,
    });
  })
);

router.post(
  '/scan',
  authenticate,
  authorizeRoles('admin', 'security'),
  validateSchema(scanSchema),
  asyncHandler(async (req, res) => {
    const rawInput = req.body.qrToken || req.body.passCode;
    if (!rawInput) {
      throw new AppError('Provide qrToken or passCode to scan', 400);
    }

    const evaluation = await evaluatePass({
      rawInput,
      organizationId: req.organizationId,
      requestedAction: req.body.action,
    });

    const scanMethod =
      req.body.method || (evaluation.parsed?.isSignedQr ? 'qr_scan' : 'manual_code');

    if (!evaluation.valid) {
      if (evaluation.pass) {
        await CheckLog.create({
          organizationId: req.organizationId,
          locationName: evaluation.pass.locationName,
          passId: evaluation.pass._id,
          appointmentId: evaluation.pass.appointmentId?._id || evaluation.pass.appointmentId,
          visitorId: evaluation.pass.visitorId?._id || evaluation.pass.visitorId,
          scannedBy: req.user._id,
          action: 'denied',
          method: scanMethod,
          gateName: req.body.gateName,
          notes: evaluation.reason,
        });
      }
      throw new AppError(evaluation.reason, evaluation.statusCode);
    }

    const { pass, resolvedAction, overstay } = evaluation;
    const appointment = await Appointment.findById(pass.appointmentId._id).select(
      '+gateOtpHash +gateOtpExpiresAt'
    );

    if (
      resolvedAction === 'check_in' &&
      appointment?.requireOtp &&
      !appointment.otpVerified
    ) {
      if (!req.body.otpCode) {
        throw new AppError('Gate OTP code is required to check in this visitor', 400);
      }
      const otpCheck = await verifyOtpCode(
        req.body.otpCode,
        appointment.gateOtpHash,
        appointment.gateOtpExpiresAt
      );
      if (!otpCheck.valid) {
        await CheckLog.create({
          organizationId: req.organizationId,
          locationName: pass.locationName,
          passId: pass._id,
          appointmentId: appointment._id,
          visitorId: pass.visitorId._id,
          scannedBy: req.user._id,
          action: 'denied',
          method: 'otp_fallback',
          gateName: req.body.gateName,
          notes: `Gate OTP failed: ${otpCheck.reason}`,
        });
        throw new AppError(`Gate OTP verification failed: ${otpCheck.reason}`, 400);
      }
      appointment.otpVerified = true;
    }

    if (resolvedAction === 'check_in') {
      pass.status = 'checked_in';
      if (appointment) appointment.status = 'checked_in';
    } else {
      pass.status = 'used';
      if (appointment) appointment.status = 'checked_out';
    }

    await Promise.all([pass.save(), appointment ? appointment.save() : Promise.resolve()]);

    const noteParts = [];
    if (req.body.notes) noteParts.push(req.body.notes);
    if (overstay) noteParts.push('Checked out after scheduled validUntil window');

    const checkLog = await CheckLog.create({
      organizationId: req.organizationId,
      locationName: pass.locationName,
      passId: pass._id,
      appointmentId: pass.appointmentId._id,
      visitorId: pass.visitorId._id,
      scannedBy: req.user._id,
      action: resolvedAction,
      method: scanMethod,
      gateName: req.body.gateName,
      notes: noteParts.join(' • '),
    });

    const host = pass.hostId;
    const visitor = pass.visitorId;
    const eventType = resolvedAction === 'check_in' ? 'VISITOR_ARRIVED' : 'VISITOR_DEPARTED';

    if (host?.email) {
      await sendEmailNotification({
        organizationId: req.organizationId,
        recipientUserId: host._id,
        to: host.email,
        subject:
          resolvedAction === 'check_in'
            ? `Visitor Arrived: ${visitor.fullName}`
            : `Visitor Checked Out: ${visitor.fullName}`,
        message: `${visitor.fullName} (${visitor.company}) ${resolvedAction === 'check_in' ? 'checked in' : 'checked out'} at ${pass.locationName} (${req.body.gateName}).`,
        eventType,
      });
    }

    if (host?.phone && resolvedAction === 'check_in') {
      await sendSmsNotification({
        organizationId: req.organizationId,
        recipientUserId: host._id,
        to: host.phone,
        message: `${visitor.fullName} (${visitor.company}) has arrived at ${pass.locationName} - ${req.body.gateName}.`,
        eventType,
      });
    }

    await recordAudit({
      organizationId: req.organizationId,
      actor: req.user,
      action: resolvedAction === 'check_in' ? 'VISITOR_CHECKED_IN' : 'VISITOR_CHECKED_OUT',
      entityType: 'CheckLog',
      entityId: checkLog._id,
      metadata: {
        passCode: pass.passCode,
        gateName: req.body.gateName,
        method: scanMethod,
      },
      ipAddress: getRequestIp(req),
    });

    res.status(201).json({
      success: true,
      action: resolvedAction,
      checkLog,
      pass,
      appointment,
    });
  })
);

router.get(
  '/',
  authenticate,
  authorizeRoles('admin', 'security', 'host'),
  asyncHandler(async (req, res) => {
    const { action, locationName, gateName, method, from, to, search, page = '1', limit = '30' } =
      req.query;

    const filter = { organizationId: req.organizationId };

    if (req.user.role === 'host') {
      const hostApts = await Appointment.find({
        organizationId: req.organizationId,
        hostId: req.user._id,
      }).select('_id');
      filter.appointmentId = { $in: hostApts.map((a) => a._id) };
    }

    if (action) filter.action = action;
    if (locationName) filter.locationName = locationName;
    if (gateName) filter.gateName = gateName;
    if (method) filter.method = method;

    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      const [matchingVisitors, matchingPasses] = await Promise.all([
        Visitor.find({
          organizationId: req.organizationId,
          $or: [{ fullName: regex }, { email: regex }, { company: regex }],
        }).select('_id'),
        Pass.find({
          organizationId: req.organizationId,
          passCode: regex,
        }).select('_id'),
      ]);
      filter.$or = [
        { visitorId: { $in: matchingVisitors.map((v) => v._id) } },
        { passId: { $in: matchingPasses.map((p) => p._id) } },
        { gateName: regex },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 30));

    const [logs, total] = await Promise.all([
      CheckLog.find(filter)
        .populate('visitorId', 'fullName email company photoUrl')
        .populate('passId', 'passCode status validFrom validUntil')
        .populate('scannedBy', 'name role')
        .sort({ timestamp: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      CheckLog.countDocuments(filter),
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
