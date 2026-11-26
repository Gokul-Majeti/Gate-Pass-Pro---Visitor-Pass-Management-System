import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { CheckLog, User } from '../src/models/index.js';
import { seedDatabase } from '../src/scripts/seedData.js';

describe('Step 4: Passes (QR + PDF Badge), Check-In/Out & Reports', () => {
  let app;

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.USE_IN_MEMORY_DB = 'true';
    await connectDB({ useInMemory: true });
    await seedDatabase({ reset: true });
    app = createApp();
  });

  after(async () => {
    await disconnectDB();
  });

  it('issues QR pass for approved appointment, generates valid PDF badge, and executes check-in/out', async () => {
    const [hostLogin, securityLogin, visitorLogin] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'host@apextech.com', password: 'Password@123' }),
      request(app).post('/api/auth/login').send({ email: 'security@apextech.com', password: 'Password@123' }),
      request(app).post('/api/auth/login').send({ email: 'visitor@example.com', password: 'Password@123' }),
    ]);

    const hostToken = hostLogin.body.token;
    const securityToken = securityLogin.body.token;
    const visitorToken = visitorLogin.body.token;

    // Host invites visitor for immediate active slot
    const start = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    const inviteRes = await request(app)
      .post('/api/appointments/invite')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        fullName: 'Aarav Sharma',
        email: 'visitor@example.com',
        phone: '+15550101005',
        purpose: 'Live Demo Review',
        scheduledStart: start,
        scheduledEnd: end,
      });
    assert.equal(inviteRes.status, 201);
    const appointmentId = inviteRes.body.appointment._id;

    // Visitor cannot issue passes directly (Security/Admin only)
    const visitorIssueDenied = await request(app)
      .post('/api/passes/issue')
      .set('Authorization', `Bearer ${visitorToken}`)
      .send({ appointmentId });
    assert.equal(visitorIssueDenied.status, 403);

    // Security issues pass
    const issueRes = await request(app)
      .post('/api/passes/issue')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ appointmentId });
    assert.equal(issueRes.status, 201);
    const pass = issueRes.body.pass;
    assert.ok(pass.passCode.startsWith('VP-'));
    assert.ok(pass.qrToken.startsWith('VPM1:'));
    assert.ok(pass.qrDataUrl.startsWith('data:image/png;base64,'));

    // Visitor can download their own PDF badge
    const pdfRes = await request(app)
      .get(`/api/passes/${pass._id}/pdf`)
      .set('Authorization', `Bearer ${visitorToken}`)
      .responseType('blob');
    assert.equal(pdfRes.status, 200);
    assert.match(pdfRes.headers['content-type'], /application\/pdf/);
    assert.equal(Buffer.from(pdfRes.body).subarray(0, 5).toString('utf8'), '%PDF-');

    // Tampered QR signature is rejected (403) and logged as denied
    const tamperedQr = `${pass.qrToken.slice(0, -4)}ffff`;
    const tamperedScan = await request(app)
      .post('/api/checklogs/scan')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ qrToken: tamperedQr, gateName: 'Main Reception' });
    assert.equal(tamperedScan.status, 403);
    const deniedLog = await CheckLog.findOne({ passId: pass._id, action: 'denied' });
    assert.ok(deniedLog);

    // Verify dry-run recommends check_in
    const verifyIn = await request(app)
      .post('/api/checklogs/verify')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ qrToken: pass.qrToken });
    assert.equal(verifyIn.status, 200);
    assert.equal(verifyIn.body.valid, true);
    assert.equal(verifyIn.body.recommendedAction, 'check_in');

    // Scan QR to check in
    const checkInRes = await request(app)
      .post('/api/checklogs/scan')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ qrToken: pass.qrToken, gateName: 'Main Reception' });
    assert.equal(checkInRes.status, 201);
    assert.equal(checkInRes.body.action, 'check_in');
    assert.equal(checkInRes.body.pass.status, 'checked_in');
    assert.equal(checkInRes.body.appointment.status, 'checked_in');

    // Scan manual passCode to check out
    const checkOutRes = await request(app)
      .post('/api/checklogs/scan')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ passCode: pass.passCode, gateName: 'Main Reception' });
    assert.equal(checkOutRes.status, 201);
    assert.equal(checkOutRes.body.action, 'check_out');
    assert.equal(checkOutRes.body.pass.status, 'used');
    assert.equal(checkOutRes.body.appointment.status, 'checked_out');
  });

  it('supports walk-in registration with instant pass, revocation, and gate OTP check-in', async () => {
    const [securityLogin, hostLogin] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'security@apextech.com', password: 'Password@123' }),
      request(app).post('/api/auth/login').send({ email: 'host@apextech.com', password: 'Password@123' }),
    ]);
    const securityToken = securityLogin.body.token;
    const hostToken = hostLogin.body.token;
    const hostUser = await User.findOne({ email: 'host@apextech.com' });

    // Walk-in pass creation + immediate revocation check
    const walkInRes = await request(app)
      .post('/api/passes/walk-in')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({
        fullName: 'Grace Hopper',
        email: 'grace@compiler.org',
        phone: '+15554443322',
        company: 'Compiler Labs',
        hostId: String(hostUser._id),
        purpose: 'Quick Package Handover',
      });
    assert.equal(walkInRes.status, 201);
    const walkInPass = walkInRes.body.pass;

    const revokeRes = await request(app)
      .patch(`/api/passes/${walkInPass._id}/revoke`)
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ reason: 'Visitor left before entering' });
    assert.equal(revokeRes.status, 200);
    assert.equal(revokeRes.body.pass.status, 'revoked');

    const scanRevoked = await request(app)
      .post('/api/checklogs/scan')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ passCode: walkInPass.passCode });
    assert.equal(scanRevoked.status, 400);

    // Gate OTP check-in flow
    const otpInvite = await request(app)
      .post('/api/appointments/invite')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        fullName: 'Alan Turing',
        email: 'alan@bletchley.uk',
        phone: '+15559998877',
        purpose: 'High Security Lab Access',
        scheduledStart: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        scheduledEnd: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        requireOtp: true,
      });
    assert.equal(otpInvite.status, 201);
    const gateOtp = otpInvite.body.devGateOtpPreview;
    assert.ok(gateOtp);

    const otpPassRes = await request(app)
      .post('/api/passes/issue')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ appointmentId: otpInvite.body.appointment._id });
    assert.equal(otpPassRes.status, 201);

    // Fails without gate OTP
    const missingOtpScan = await request(app)
      .post('/api/checklogs/scan')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ qrToken: otpPassRes.body.pass.qrToken });
    assert.equal(missingOtpScan.status, 400);

    // Succeeds with valid gate OTP
    const validOtpScan = await request(app)
      .post('/api/checklogs/scan')
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ qrToken: otpPassRes.body.pass.qrToken, otpCode: gateOtp });
    assert.equal(validOtpScan.status, 201);
    assert.equal(validOtpScan.body.action, 'check_in');
  });

  it('computes analytics KPIs and exports filtered visitor reports as CSV', async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@apextech.com', password: 'Password@123' });
    const adminToken = adminLogin.body.token;

    const analyticsRes = await request(app)
      .get('/api/reports/analytics?days=7')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(analyticsRes.status, 200);
    assert.ok(typeof analyticsRes.body.kpis.currentlyOnSite === 'number');
    assert.equal(analyticsRes.body.dailyTrend.length, 7);
    assert.ok(Array.isArray(analyticsRes.body.byStatus));
    assert.ok(Array.isArray(analyticsRes.body.byLocation));

    const csvRes = await request(app)
      .get('/api/reports/export')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(csvRes.status, 200);
    assert.match(csvRes.headers['content-type'], /text\/csv/);
    assert.match(csvRes.text, /AppointmentID,PassCode,PassStatus,AppointmentStatus/);
    assert.match(csvRes.text, /VP-2026-100001/);
  });
});
