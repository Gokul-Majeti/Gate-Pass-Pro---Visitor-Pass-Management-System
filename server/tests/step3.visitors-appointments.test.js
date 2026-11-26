import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/index.js';
import { seedDatabase } from '../src/scripts/seedData.js';

// Minimal valid 1x1 transparent PNG buffer for upload tests
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

describe('Step 3: Visitor Registration (Photos), Appointments & Notifications', () => {
  let app;
  const createdFiles = [];

  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.USE_IN_MEMORY_DB = 'true';
    await connectDB({ useInMemory: true });
    await seedDatabase({ reset: true });
    app = createApp();
  });

  after(async () => {
    for (const relUrl of createdFiles) {
      const filename = path.basename(relUrl);
      const fullPath = path.resolve(env.uploadDir, 'visitors', filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    await disconnectDB();
  });

  it('registers a visitor with multipart photo upload and serves the image over HTTP', async () => {
    const securityLogin = await request(app).post('/api/auth/login').send({
      email: 'security@apextech.com',
      password: 'Password@123',
    });
    const securityToken = securityLogin.body.token;

    const createRes = await request(app)
      .post('/api/visitors')
      .set('Authorization', `Bearer ${securityToken}`)
      .field('fullName', 'Olivia Bennett')
      .field('email', 'olivia.b@partner.co')
      .field('phone', '+15557770011')
      .field('company', 'NorthStar Analytics')
      .field('idType', 'passport')
      .field('idNumber', 'PP-554120')
      .attach('photo', TINY_PNG_BUFFER, { filename: 'olivia.png', contentType: 'image/png' });

    assert.equal(createRes.status, 201);
    assert.ok(createRes.body.visitor.photoUrl.startsWith('/uploads/visitors/'));
    createdFiles.push(createRes.body.visitor.photoUrl);

    const staticRes = await request(app).get(createRes.body.visitor.photoUrl);
    assert.equal(staticRes.status, 200);
    assert.match(staticRes.headers['content-type'], /image\/png/);
  });

  it('supports visitor pre-registration with webcam base64 photo, host approval, and notifications', async () => {
    const [visitorLogin, host1Login, host2Login] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'visitor@example.com', password: 'Password@123' }),
      request(app).post('/api/auth/login').send({ email: 'host@apextech.com', password: 'Password@123' }),
      request(app).post('/api/auth/login').send({ email: 'host2@apextech.com', password: 'Password@123' }),
    ]);

    const visitorToken = visitorLogin.body.token;
    const host1Token = host1Login.body.token;
    const host2Token = host2Login.body.token;
    const host1User = await User.findOne({ email: 'host@apextech.com' });

    const start = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const photoBase64 = `data:image/png;base64,${TINY_PNG_BUFFER.toString('base64')}`;

    const preRegRes = await request(app)
      .post('/api/appointments/pre-register')
      .set('Authorization', `Bearer ${visitorToken}`)
      .send({
        hostId: String(host1User._id),
        locationName: 'HQ Tower',
        purpose: 'Security Architecture Briefing',
        category: 'business_meeting',
        scheduledStart: start,
        scheduledEnd: end,
        photoBase64,
      });

    assert.equal(preRegRes.status, 201);
    assert.equal(preRegRes.body.appointment.status, 'pending');
    assert.ok(preRegRes.body.appointment.visitorId.photoUrl.startsWith('/uploads/visitors/'));
    createdFiles.push(preRegRes.body.appointment.visitorId.photoUrl);

    const aptId = preRegRes.body.appointment._id;

    // Host2 (not assigned to this appointment) cannot approve Host1's visit
    const unauthorizedApprove = await request(app)
      .patch(`/api/appointments/${aptId}/status`)
      .set('Authorization', `Bearer ${host2Token}`)
      .send({ status: 'approved' });
    assert.equal(unauthorizedApprove.status, 403);

    // Assigned Host1 approves the visit
    const approveRes = await request(app)
      .patch(`/api/appointments/${aptId}/status`)
      .set('Authorization', `Bearer ${host1Token}`)
      .send({ status: 'approved', approvalNote: 'See you at Room 3A' });

    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.appointment.status, 'approved');

    // Notifications recorded for both host and visitor
    const visitorNotifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${visitorToken}`);
    assert.equal(visitorNotifs.status, 200);
    assert.ok(
      visitorNotifs.body.notifications.some((n) => n.eventType === 'APPOINTMENT_APPROVED')
    );
  });

  it('allows host to invite a visitor with gate OTP and blocks watchlisted visitors', async () => {
    const [hostLogin, securityLogin] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'host@apextech.com', password: 'Password@123' }),
      request(app).post('/api/auth/login').send({ email: 'security@apextech.com', password: 'Password@123' }),
    ]);

    const hostToken = hostLogin.body.token;
    const securityToken = securityLogin.body.token;

    const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    const inviteRes = await request(app)
      .post('/api/appointments/invite')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        fullName: 'Carlos Rivera',
        email: 'carlos.r@vendor.io',
        phone: '+15558881212',
        company: 'CloudNet',
        purpose: 'Network Audit',
        scheduledStart: start,
        scheduledEnd: end,
        requireOtp: true,
      });

    assert.equal(inviteRes.status, 201);
    assert.equal(inviteRes.body.appointment.status, 'approved');
    assert.equal(inviteRes.body.appointment.type, 'host_invited');
    assert.ok(inviteRes.body.devGateOtpPreview);

    const visitorId = inviteRes.body.appointment.visitorId._id;

    // Security flags visitor on watchlist
    const watchlistRes = await request(app)
      .patch(`/api/visitors/${visitorId}`)
      .set('Authorization', `Bearer ${securityToken}`)
      .send({ isWatchlisted: true, watchlistReason: 'Expired NDA' });
    assert.equal(watchlistRes.status, 200);
    assert.equal(watchlistRes.body.visitor.isWatchlisted, true);

    // Watchlisted visitor cannot be invited again
    const blockedInvite = await request(app)
      .post('/api/appointments/invite')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        visitorId,
        purpose: 'Follow up',
        scheduledStart: start,
        scheduledEnd: end,
      });
    assert.equal(blockedInvite.status, 403);
  });
});
