import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Notification, User, Visitor } from '../src/models/index.js';
import { seedDatabase } from '../src/scripts/seedData.js';

describe('Step 2: Authentication, RBAC, OTP & Multi-Organization', () => {
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

  it('authenticates seeded users with JWT and rejects invalid credentials', async () => {
    const badRes = await request(app).post('/api/auth/login').send({
      email: 'admin@apextech.com',
      password: 'WrongPassword',
    });
    assert.equal(badRes.status, 401);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'admin@apextech.com',
      password: 'Password@123',
    });
    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.body.token);
    assert.equal(loginRes.body.user.role, 'admin');
    assert.equal(loginRes.body.organization.slug, 'apex-tech');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.email, 'admin@apextech.com');
  });

  it('registers a visitor with OTP verification and creates a linked Visitor profile', async () => {
    const publicOrgs = await request(app).get('/api/organizations/public');
    assert.equal(publicOrgs.status, 200);
    assert.equal(publicOrgs.body.organizations.length, 2);

    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Nadia Patel',
      email: 'nadia.patel@guest.io',
      phone: '+15559990001',
      password: 'Password@123',
      company: 'PixelCraft',
      organizationSlug: 'apex-tech',
    });
    assert.equal(regRes.status, 201);
    assert.equal(regRes.body.user.role, 'visitor');
    assert.equal(regRes.body.user.isVerified, false);
    assert.ok(regRes.body.devOtpPreview);

    const visitorRecord = await Visitor.findOne({ email: 'nadia.patel@guest.io' });
    assert.ok(visitorRecord);
    assert.equal(visitorRecord.company, 'PixelCraft');

    const badOtp = await request(app)
      .post('/api/auth/verify-otp')
      .set('Authorization', `Bearer ${regRes.body.token}`)
      .send({ otp: '000000' });
    assert.equal(badOtp.status, 400);

    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .set('Authorization', `Bearer ${regRes.body.token}`)
      .send({ otp: regRes.body.devOtpPreview });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.user.isVerified, true);

    const otpNotifications = await Notification.find({ recipient: 'nadia.patel@guest.io' });
    assert.ok(otpNotifications.length >= 1);
  });

  it('enforces RBAC boundaries across roles and multi-organization tenant isolation', async () => {
    const [apexAdminLogin, novaAdminLogin, hostLogin, visitorLogin] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'admin@apextech.com', password: 'Password@123' }),
      request(app).post('/api/auth/login').send({ email: 'admin@novabio.com', password: 'Password@123' }),
      request(app).post('/api/auth/login').send({ email: 'host@apextech.com', password: 'Password@123' }),
      request(app).post('/api/auth/login').send({ email: 'visitor@example.com', password: 'Password@123' }),
    ]);

    const apexAdminToken = apexAdminLogin.body.token;
    const novaAdminToken = novaAdminLogin.body.token;
    const hostToken = hostLogin.body.token;
    const visitorToken = visitorLogin.body.token;

    // Non-admins cannot list or create staff or view audit logs
    const hostListUsers = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(hostListUsers.status, 403);

    const visitorAudit = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${visitorToken}`);
    assert.equal(visitorAudit.status, 403);

    // Authenticated users can look up hosts within their own org
    const hostLookup = await request(app)
      .get('/api/users/hosts')
      .set('Authorization', `Bearer ${visitorToken}`);
    assert.equal(hostLookup.status, 200);
    assert.ok(hostLookup.body.hosts.every((h) => !h.email.endsWith('@novabio.com')));

    // Admin creates new staff member in Apex Tech
    const createStaff = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${apexAdminToken}`)
      .send({
        name: 'Jordan Guard',
        email: 'guard2@apextech.com',
        phone: '+15550101099',
        password: 'Password@123',
        role: 'security',
        department: 'East Gate Security',
        locationName: 'HQ Tower',
      });
    assert.equal(createStaff.status, 201);
    assert.equal(createStaff.body.user.role, 'security');

    // NovaBio admin cannot modify Apex Tech staff (tenant isolation)
    const novaCrossEdit = await request(app)
      .patch(`/api/users/${createStaff.body.user._id}`)
      .set('Authorization', `Bearer ${novaAdminToken}`)
      .send({ isActive: false });
    assert.equal(novaCrossEdit.status, 404);

    // NovaBio admin only sees NovaBio users
    const novaUsers = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${novaAdminToken}`);
    assert.equal(novaUsers.status, 200);
    assert.ok(novaUsers.body.users.every((u) => u.email.endsWith('@novabio.com')));
  });

  it('allows onboarding a brand new organization and adding multiple locations', async () => {
    const onboardRes = await request(app).post('/api/auth/register').send({
      name: 'Samira Khan',
      email: 'samira@orbitworks.io',
      phone: '+15550303001',
      password: 'Password@123',
      createOrganization: true,
      organizationName: 'OrbitWorks Studio',
      industry: 'Aerospace',
      locationName: 'Launch Hangar',
    });
    assert.equal(onboardRes.status, 201);
    assert.equal(onboardRes.body.user.role, 'admin');
    assert.equal(onboardRes.body.organization.slug, 'orbitworks-studio');

    const addLoc = await request(app)
      .post('/api/organizations/current/locations')
      .set('Authorization', `Bearer ${onboardRes.body.token}`)
      .send({
        name: 'Propulsion Lab',
        code: 'PROP',
        address: '99 Orbit Dr',
        gates: ['Security Checkpoint A'],
      });
    assert.equal(addLoc.status, 201);
    assert.equal(addLoc.body.organization.locations.length, 2);

    const audits = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${onboardRes.body.token}`);
    assert.equal(audits.status, 200);
    assert.ok(audits.body.logs.some((l) => l.action === 'LOCATION_ADDED'));
    assert.ok(audits.body.logs.some((l) => l.action === 'ORGANIZATION_REGISTERED'));

    const createdSamira = await User.findOne({ email: 'samira@orbitworks.io' });
    assert.ok(createdSamira);
  });
});
