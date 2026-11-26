import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { getDatabaseMode } from './config/db.js';
import { env } from './config/env.js';
import {
  Appointment,
  AuditLog,
  CheckLog,
  Notification,
  Organization,
  Pass,
  User,
  Visitor,
} from './models/index.js';
import auditRoutes from './routes/auditRoutes.js';
import authRoutes from './routes/authRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import checkLogRoutes from './routes/checkLogRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import passRoutes from './routes/passRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import userRoutes from './routes/userRoutes.js';
import visitorRoutes from './routes/visitorRoutes.js';

export function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    })
  );
  if (!env.isTest) {
    app.use(morgan('dev'));
  }
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/uploads', express.static(path.resolve(env.uploadDir)));

  app.get('/api/health', async (_req, res, next) => {
    try {
      const dbMode = getDatabaseMode();
      const counts =
        dbMode === 'disconnected'
          ? null
          : {
              organizations: await Organization.countDocuments(),
              users: await User.countDocuments(),
              visitors: await Visitor.countDocuments(),
              appointments: await Appointment.countDocuments(),
              passes: await Pass.countDocuments(),
              checkLogs: await CheckLog.countDocuments(),
              auditLogs: await AuditLog.countDocuments(),
              notifications: await Notification.countDocuments(),
            };

      res.json({
        status: 'ok',
        service: 'visitor-pass-api',
        environment: env.nodeEnv,
        databaseMode: dbMode,
        counts,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/visitors', visitorRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/passes', passRoutes);
  app.use('/api/checklogs', checkLogRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/audit-logs', auditRoutes);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  app.use((err, _req, res, _next) => {
    let status = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let details = err.details || null;

    if (err.name === 'MulterError') {
      status = 400;
      message = err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded photo exceeds size limit' : err.message;
    } else if (err.name === 'CastError') {
      status = 400;
      message = `Invalid identifier for field '${err.path}'`;
    } else if (err.name === 'ValidationError') {
      status = 400;
      message = 'Database validation failed';
      details = Object.values(err.errors).map((e) => ({
        path: e.path,
        message: e.message,
      }));
    } else if (err.code === 11000) {
      status = 409;
      const fields = Object.keys(err.keyPattern || {});
      message = `Duplicate value for ${fields.join(', ') || 'unique field'}`;
    }

    res.status(status).json({
      success: false,
      message,
      ...(details ? { details } : {}),
    });
  });

  return app;
}
