import { AuditLog } from '../models/index.js';

export function getRequestIp(req) {
  if (!req) return '';
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}

/**
 * Persists an audit trail entry for security-sensitive actions.
 */
export async function recordAudit({
  organizationId = null,
  actor = null,
  action,
  entityType,
  entityId = null,
  metadata = {},
  ipAddress = '',
}) {
  try {
    return await AuditLog.create({
      organizationId: organizationId || actor?.organizationId || null,
      actorId: actor?._id || null,
      actorRole: actor?.role || 'system',
      actorName: actor?.name || 'System',
      action,
      entityType,
      entityId,
      metadata,
      ipAddress,
    });
  } catch (err) {
    console.error('[Audit] Failed to record audit log:', err.message);
    return null;
  }
}
