import express from 'express';
import { z } from 'zod';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { Organization } from '../models/index.js';
import { getRequestIp, recordAudit } from '../services/auditService.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { validateSchema } from '../utils/validate.js';

const router = express.Router();

const updateOrgSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  industry: z.string().trim().max(80).optional(),
  settings: z
    .object({
      requireHostApproval: z.boolean().optional(),
      requireOtpAtGate: z.boolean().optional(),
      defaultPassDurationHours: z.number().int().min(1).max(72).optional(),
      primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    })
    .optional(),
});

const locationInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(16).toUpperCase(),
  address: z.string().trim().max(240).optional().default(''),
  gates: z.array(z.string().trim().min(1).max(80)).min(1).optional().default(['Main Reception']),
  isActive: z.boolean().optional().default(true),
});

const locationUpdateSchema = locationInputSchema.partial();

router.get(
  '/public',
  asyncHandler(async (_req, res) => {
    const organizations = await Organization.find({ isActive: true })
      .select('name slug industry locations settings.primaryColor settings.requireOtpAtGate settings.requireHostApproval')
      .sort({ name: 1 });

    res.json({
      success: true,
      organizations,
    });
  })
);

router.get(
  '/current',
  authenticate,
  asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.organizationId);
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }
    res.json({
      success: true,
      organization,
    });
  })
);

router.patch(
  '/current',
  authenticate,
  authorizeRoles('admin'),
  validateSchema(updateOrgSchema),
  asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.organizationId);
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    if (req.body.name) organization.name = req.body.name;
    if (req.body.industry !== undefined) organization.industry = req.body.industry;
    if (req.body.settings) {
      organization.settings = {
        ...organization.settings.toObject(),
        ...req.body.settings,
      };
    }

    await organization.save();

    await recordAudit({
      organizationId: organization._id,
      actor: req.user,
      action: 'ORGANIZATION_UPDATED',
      entityType: 'Organization',
      entityId: organization._id,
      metadata: req.body,
      ipAddress: getRequestIp(req),
    });

    res.json({
      success: true,
      organization,
    });
  })
);

router.post(
  '/current/locations',
  authenticate,
  authorizeRoles('admin'),
  validateSchema(locationInputSchema),
  asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.organizationId);
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    const duplicate = organization.locations.some(
      (loc) =>
        loc.name.toLowerCase() === req.body.name.toLowerCase() ||
        loc.code.toLowerCase() === req.body.code.toLowerCase()
    );
    if (duplicate) {
      throw new AppError('A location with that name or code already exists', 409);
    }

    organization.locations.push(req.body);
    await organization.save();

    await recordAudit({
      organizationId: organization._id,
      actor: req.user,
      action: 'LOCATION_ADDED',
      entityType: 'Organization',
      entityId: organization._id,
      metadata: { locationName: req.body.name, code: req.body.code },
      ipAddress: getRequestIp(req),
    });

    res.status(201).json({
      success: true,
      organization,
    });
  })
);

router.patch(
  '/current/locations/:locationId',
  authenticate,
  authorizeRoles('admin'),
  validateSchema(locationUpdateSchema),
  asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.organizationId);
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    const location = organization.locations.id(req.params.locationId);
    if (!location) {
      throw new AppError('Location not found', 404);
    }

    Object.assign(location, req.body);
    await organization.save();

    await recordAudit({
      organizationId: organization._id,
      actor: req.user,
      action: 'LOCATION_UPDATED',
      entityType: 'Organization',
      entityId: organization._id,
      metadata: { locationId: req.params.locationId, updates: req.body },
      ipAddress: getRequestIp(req),
    });

    res.json({
      success: true,
      organization,
    });
  })
);

export default router;
