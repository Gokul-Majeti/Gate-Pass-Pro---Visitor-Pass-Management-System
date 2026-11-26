import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import {
  Appointment,
  Organization,
  Pass,
  User,
  Visitor,
} from '../src/models/index.js';
import { seedDatabase } from '../src/scripts/seedData.js';

describe('Step 1: Database Layer, Models & Seed Verification', () => {
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

  it('seeds all required collections and bonus collections cleanly', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.databaseMode, 'in-memory');
    assert.deepEqual(res.body.counts, {
      organizations: 2,
      users: 7,
      visitors: 5,
      appointments: 6,
      passes: 3,
      checkLogs: 3,
      auditLogs: 2,
      notifications: 2,
    });
  });

  it('hashes and verifies demo user passwords without exposing sensitive fields in JSON', async () => {
    const admin = await User.findOne({ email: 'admin@apextech.com' }).select('+passwordHash');
    assert.ok(admin, 'Admin user should exist');
    assert.equal(await admin.comparePassword('Password@123'), true);
    assert.equal(await admin.comparePassword('WrongPassword'), false);

    const safeJson = admin.toJSON();
    assert.equal(safeJson.passwordHash, undefined);
    assert.equal(safeJson.role, 'admin');
  });

  it('enforces appointment and pass time-window validation rules', async () => {
    const org = await Organization.findOne({ slug: 'apex-tech' });
    const visitor = await Visitor.findOne({ organizationId: org._id });
    const host = await User.findOne({ email: 'host@apextech.com' });

    const now = new Date();
    const invalidAppointment = new Appointment({
      organizationId: org._id,
      visitorId: visitor._id,
      hostId: host._id,
      createdBy: host._id,
      purpose: 'Invalid time window test',
      scheduledStart: now,
      scheduledEnd: new Date(now.getTime() - 60_000),
    });

    await assert.rejects(invalidAppointment.validate(), /scheduledEnd must be after scheduledStart/);

    const invalidPass = new Pass({
      organizationId: org._id,
      appointmentId: invalidAppointment._id,
      visitorId: visitor._id,
      hostId: host._id,
      issuedBy: host._id,
      passCode: 'VP-TEST-0001',
      qrToken: 'token-test-0001',
      validFrom: now,
      validUntil: now,
    });

    await assert.rejects(invalidPass.validate(), /validUntil must be after validFrom/);
  });
});
