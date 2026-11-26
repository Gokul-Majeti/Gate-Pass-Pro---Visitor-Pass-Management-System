import {
  Appointment,
  AuditLog,
  CheckLog,
  Notification,
  Organization,
  Pass,
  User,
  Visitor,
} from '../models/index.js';
import { generateQrDataUrl, signQrToken } from '../services/passService.js';

const DEMO_PASSWORD = 'Password@123';

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Seeds the database with realistic multi-organization demo data covering all user roles,
 * visitor profiles, appointments, passes, check logs, notifications, and audit logs.
 */
export async function seedDatabase({ reset = false } = {}) {
  if (!reset) {
    const existingOrgs = await Organization.countDocuments();
    if (existingOrgs > 0) {
      return { skipped: true, reason: 'Database already contains organizations' };
    }
  } else {
    await Promise.all([
      CheckLog.deleteMany({}),
      Pass.deleteMany({}),
      Appointment.deleteMany({}),
      Visitor.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({}),
      User.deleteMany({}),
      Organization.deleteMany({}),
    ]);
  }

  const [apexOrg, novaOrg] = await Organization.create([
    {
      name: 'Apex Tech Corp',
      slug: 'apex-tech',
      industry: 'Technology & SaaS',
      locations: [
        {
          name: 'HQ Tower',
          code: 'HQ',
          address: '450 Innovation Way, Tech Park',
          gates: ['Main Reception', 'Executive Lobby', 'East Gate'],
          isActive: true,
        },
        {
          name: 'R&D Annex',
          code: 'RND',
          address: '120 Research Blvd, North Wing',
          gates: ['Lab Entrance', 'Loading Dock'],
          isActive: true,
        },
      ],
      settings: {
        requireHostApproval: true,
        requireOtpAtGate: false,
        defaultPassDurationHours: 8,
        primaryColor: '#2563eb',
      },
    },
    {
      name: 'NovaBio Labs',
      slug: 'novabio',
      industry: 'Biotechnology',
      locations: [
        {
          name: 'Clinical Campus',
          code: 'CLIN',
          address: '88 Genome Ave, Bio District',
          gates: ['Reception A', 'Cleanroom Gate'],
          isActive: true,
        },
      ],
      settings: {
        requireHostApproval: true,
        requireOtpAtGate: true,
        defaultPassDurationHours: 4,
        primaryColor: '#0d9488',
      },
    },
  ]);

  const passwordHash = await User.hashPassword(DEMO_PASSWORD);

  const [
    apexAdmin,
    apexSecurity,
    apexHost,
    apexHostHr,
    apexVisitorUser,
    novaAdmin,
    novaHost,
  ] = await User.create([
    {
      organizationId: apexOrg._id,
      locationName: 'HQ Tower',
      name: 'Elena Vance',
      email: 'admin@apextech.com',
      phone: '+15550101001',
      passwordHash,
      role: 'admin',
      department: 'Operations & Security',
      isVerified: true,
    },
    {
      organizationId: apexOrg._id,
      locationName: 'HQ Tower',
      name: 'Marcus Cole',
      email: 'security@apextech.com',
      phone: '+15550101002',
      passwordHash,
      role: 'security',
      department: 'Frontdesk Security',
      isVerified: true,
    },
    {
      organizationId: apexOrg._id,
      locationName: 'HQ Tower',
      name: 'Priya Nair',
      email: 'host@apextech.com',
      phone: '+15550101003',
      passwordHash,
      role: 'host',
      department: 'Platform Engineering',
      isVerified: true,
    },
    {
      organizationId: apexOrg._id,
      locationName: 'R&D Annex',
      name: 'Daniel Brooks',
      email: 'host2@apextech.com',
      phone: '+15550101004',
      passwordHash,
      role: 'host',
      department: 'Talent Acquisition',
      isVerified: true,
    },
    {
      organizationId: apexOrg._id,
      locationName: 'HQ Tower',
      name: 'Aarav Sharma',
      email: 'visitor@example.com',
      phone: '+15550101005',
      passwordHash,
      role: 'visitor',
      department: 'External Guest',
      isVerified: true,
    },
    {
      organizationId: novaOrg._id,
      locationName: 'Clinical Campus',
      name: 'Dr. Clara Chen',
      email: 'admin@novabio.com',
      phone: '+15550202001',
      passwordHash,
      role: 'admin',
      department: 'Facility Compliance',
      isVerified: true,
    },
    {
      organizationId: novaOrg._id,
      locationName: 'Clinical Campus',
      name: 'Liam OConnor',
      email: 'host@novabio.com',
      phone: '+15550202002',
      passwordHash,
      role: 'host',
      department: 'Clinical Trials',
      isVerified: true,
    },
  ]);

  const [vAarav, vSofia, vKenji, vMaya, vNovaGuest] = await Visitor.create([
    {
      organizationId: apexOrg._id,
      userId: apexVisitorUser._id,
      fullName: 'Aarav Sharma',
      email: 'visitor@example.com',
      phone: '+15550101005',
      company: 'CloudScale Solutions',
      idType: 'national_id',
      idNumber: 'NID-884210',
      vehicleNumber: 'CA-7821-XP',
      notes: 'Partner architecture review guest',
    },
    {
      organizationId: apexOrg._id,
      fullName: 'Sofia Martinez',
      email: 'sofia.martinez@designhub.io',
      phone: '+15550101011',
      company: 'DesignHub Studio',
      idType: 'driving_license',
      idNumber: 'DL-449012',
      notes: 'UX design contractor',
    },
    {
      organizationId: apexOrg._id,
      fullName: 'Kenji Takahashi',
      email: 'kenji.t@globalhardware.jp',
      phone: '+15550101012',
      company: 'Global Hardware Inc.',
      idType: 'passport',
      idNumber: 'PP-992104',
      notes: 'Server hardware installation vendor',
    },
    {
      organizationId: apexOrg._id,
      fullName: 'Maya Lin',
      email: 'maya.lin@candidate.dev',
      phone: '+15550101013',
      company: 'Independent',
      idType: 'national_id',
      idNumber: 'NID-310992',
      notes: 'Final round engineering interview',
    },
    {
      organizationId: novaOrg._id,
      fullName: 'Dr. Ethan Park',
      email: 'ethan.park@medaudit.org',
      phone: '+15550202010',
      company: 'MedAudit Consortium',
      idType: 'passport',
      idNumber: 'PP-771203',
      notes: 'Regulatory inspection visit',
    },
  ]);

  const [aptApproved, aptCheckedIn, aptPending, aptCheckedOut, aptRejected, aptNovaApproved] =
    await Appointment.create([
      {
        organizationId: apexOrg._id,
        locationName: 'HQ Tower',
        visitorId: vAarav._id,
        hostId: apexHost._id,
        createdBy: apexVisitorUser._id,
        purpose: 'Q4 API Integration & Architecture Workshop',
        category: 'business_meeting',
        type: 'pre_registered',
        scheduledStart: hoursFromNow(-0.25),
        scheduledEnd: hoursFromNow(5),
        status: 'approved',
        approvalNote: 'Approved for Conference Room 4B',
        approvedBy: apexHost._id,
        approvedAt: hoursFromNow(-2),
      },
      {
        organizationId: apexOrg._id,
        locationName: 'HQ Tower',
        visitorId: vSofia._id,
        hostId: apexHost._id,
        createdBy: apexHost._id,
        purpose: 'Design System Audit & Product Review',
        category: 'vendor',
        type: 'host_invited',
        scheduledStart: hoursFromNow(-1),
        scheduledEnd: hoursFromNow(4),
        status: 'checked_in',
        approvalNote: 'Invited by Platform Engineering',
        approvedBy: apexHost._id,
        approvedAt: hoursFromNow(-12),
      },
      {
        organizationId: apexOrg._id,
        locationName: 'R&D Annex',
        visitorId: vMaya._id,
        hostId: apexHostHr._id,
        createdBy: apexHostHr._id,
        purpose: 'Senior Backend Engineer Onsite Interview',
        category: 'interview',
        type: 'pre_registered',
        scheduledStart: hoursFromNow(3),
        scheduledEnd: hoursFromNow(6),
        status: 'pending',
      },
      {
        organizationId: apexOrg._id,
        locationName: 'R&D Annex',
        visitorId: vKenji._id,
        hostId: apexHost._id,
        createdBy: apexSecurity._id,
        purpose: 'Rack Hardware Maintenance & Firmware Update',
        category: 'maintenance',
        type: 'walk_in',
        scheduledStart: hoursFromNow(-26),
        scheduledEnd: hoursFromNow(-22),
        status: 'checked_out',
        approvalNote: 'Cleared by IT Infrastructure',
        approvedBy: apexHost._id,
        approvedAt: hoursFromNow(-26),
      },
      {
        organizationId: apexOrg._id,
        locationName: 'HQ Tower',
        visitorId: vAarav._id,
        hostId: apexHostHr._id,
        createdBy: apexVisitorUser._id,
        purpose: 'Unscheduled Facility Tour',
        category: 'other',
        type: 'pre_registered',
        scheduledStart: hoursFromNow(-48),
        scheduledEnd: hoursFromNow(-46),
        status: 'rejected',
        approvalNote: 'Reschedule required due to townhall event',
        approvedBy: apexHostHr._id,
        approvedAt: hoursFromNow(-50),
      },
      {
        organizationId: novaOrg._id,
        locationName: 'Clinical Campus',
        visitorId: vNovaGuest._id,
        hostId: novaHost._id,
        createdBy: novaHost._id,
        purpose: 'ISO Lab Compliance Audit',
        category: 'business_meeting',
        type: 'host_invited',
        scheduledStart: hoursFromNow(2),
        scheduledEnd: hoursFromNow(6),
        status: 'approved',
        approvalNote: 'Require OTP verification at Cleanroom Gate',
        approvedBy: novaHost._id,
        approvedAt: hoursFromNow(-4),
        requireOtp: true,
      },
    ]);

  const qrToken1 = signQrToken('VP-2026-100001', apexOrg._id, aptApproved._id);
  const qrToken2 = signQrToken('VP-2026-100002', apexOrg._id, aptCheckedIn._id);
  const qrToken3 = signQrToken('VP-2026-100003', apexOrg._id, aptCheckedOut._id);

  const [qrDataUrl1, qrDataUrl2, qrDataUrl3] = await Promise.all([
    generateQrDataUrl(qrToken1),
    generateQrDataUrl(qrToken2),
    generateQrDataUrl(qrToken3),
  ]);

  const [passApproved, passCheckedIn, passUsed] = await Pass.create([
    {
      organizationId: apexOrg._id,
      locationName: 'HQ Tower',
      appointmentId: aptApproved._id,
      visitorId: vAarav._id,
      hostId: apexHost._id,
      issuedBy: apexSecurity._id,
      passCode: 'VP-2026-100001',
      qrToken: qrToken1,
      qrDataUrl: qrDataUrl1,
      validFrom: aptApproved.scheduledStart,
      validUntil: aptApproved.scheduledEnd,
      status: 'active',
    },
    {
      organizationId: apexOrg._id,
      locationName: 'HQ Tower',
      appointmentId: aptCheckedIn._id,
      visitorId: vSofia._id,
      hostId: apexHost._id,
      issuedBy: apexSecurity._id,
      passCode: 'VP-2026-100002',
      qrToken: qrToken2,
      qrDataUrl: qrDataUrl2,
      validFrom: aptCheckedIn.scheduledStart,
      validUntil: aptCheckedIn.scheduledEnd,
      status: 'checked_in',
    },
    {
      organizationId: apexOrg._id,
      locationName: 'R&D Annex',
      appointmentId: aptCheckedOut._id,
      visitorId: vKenji._id,
      hostId: apexHost._id,
      issuedBy: apexSecurity._id,
      passCode: 'VP-2026-100003',
      qrToken: qrToken3,
      qrDataUrl: qrDataUrl3,
      validFrom: aptCheckedOut.scheduledStart,
      validUntil: aptCheckedOut.scheduledEnd,
      status: 'used',
    },
  ]);

  await CheckLog.create([
    {
      organizationId: apexOrg._id,
      locationName: 'HQ Tower',
      passId: passCheckedIn._id,
      appointmentId: aptCheckedIn._id,
      visitorId: vSofia._id,
      scannedBy: apexSecurity._id,
      action: 'check_in',
      method: 'qr_scan',
      gateName: 'Main Reception',
      notes: 'Badge verified and lanyard issued',
      timestamp: hoursFromNow(-1),
    },
    {
      organizationId: apexOrg._id,
      locationName: 'R&D Annex',
      passId: passUsed._id,
      appointmentId: aptCheckedOut._id,
      visitorId: vKenji._id,
      scannedBy: apexSecurity._id,
      action: 'check_in',
      method: 'manual_code',
      gateName: 'Lab Entrance',
      notes: 'Vendor escorted by IT team',
      timestamp: hoursFromNow(-26),
    },
    {
      organizationId: apexOrg._id,
      locationName: 'R&D Annex',
      passId: passUsed._id,
      appointmentId: aptCheckedOut._id,
      visitorId: vKenji._id,
      scannedBy: apexSecurity._id,
      action: 'check_out',
      method: 'qr_scan',
      gateName: 'Lab Entrance',
      notes: 'Maintenance completed, badge returned',
      timestamp: hoursFromNow(-22),
    },
  ]);

  await Notification.create([
    {
      organizationId: apexOrg._id,
      recipientUserId: apexVisitorUser._id,
      recipient: apexVisitorUser.email,
      channel: 'email',
      eventType: 'PASS_ISSUED',
      subject: 'Your Digital Visitor Pass (VP-2026-100001) is Ready',
      message: `Hello Aarav Sharma, your visit with Priya Nair at Apex Tech Corp (HQ Tower) is approved. Pass Code: ${passApproved.passCode}.`,
      status: 'simulated',
      providerInfo: 'seed-demo',
    },
    {
      organizationId: apexOrg._id,
      recipientUserId: apexHost._id,
      recipient: apexHost.phone,
      channel: 'sms',
      eventType: 'VISITOR_ARRIVED',
      subject: 'Visitor Checked In',
      message: 'Sofia Martinez (DesignHub Studio) has checked in at HQ Tower - Main Reception.',
      status: 'simulated',
      providerInfo: 'seed-demo',
    },
  ]);

  await AuditLog.create([
    {
      organizationId: apexOrg._id,
      actorId: apexAdmin._id,
      actorRole: 'admin',
      actorName: apexAdmin.name,
      action: 'SEED_DATABASE_INITIALIZED',
      entityType: 'Organization',
      entityId: apexOrg._id,
      metadata: { locations: ['HQ Tower', 'R&D Annex'] },
    },
    {
      organizationId: apexOrg._id,
      actorId: apexSecurity._id,
      actorRole: 'security',
      actorName: apexSecurity.name,
      action: 'PASS_ISSUED',
      entityType: 'Pass',
      entityId: passApproved._id,
      metadata: { passCode: passApproved.passCode, visitor: vAarav.fullName },
    },
  ]);

  return {
    skipped: false,
    counts: {
      organizations: 2,
      users: 7,
      visitors: 5,
      appointments: 6,
      passes: 3,
      checkLogs: 3,
      notifications: 2,
      auditLogs: 2,
    },
    demoCredentials: [
      { role: 'Admin (Apex Tech)', email: 'admin@apextech.com', password: DEMO_PASSWORD },
      { role: 'Security (Apex Tech)', email: 'security@apextech.com', password: DEMO_PASSWORD },
      { role: 'Host (Apex Tech)', email: 'host@apextech.com', password: DEMO_PASSWORD },
      { role: 'Visitor (Apex Tech)', email: 'visitor@example.com', password: DEMO_PASSWORD },
      { role: 'Admin (NovaBio Labs)', email: 'admin@novabio.com', password: DEMO_PASSWORD },
    ],
  };
}
