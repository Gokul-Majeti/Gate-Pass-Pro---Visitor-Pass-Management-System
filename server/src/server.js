import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { seedDatabase } from './scripts/seedData.js';

async function bootstrap() {
  const dbInfo = await connectDB();
  console.log(`[Server] MongoDB connected (${dbInfo.mode})`);

  // Auto-seed in-memory DB so dev/demo sessions always have initial accounts & sample records
  if (dbInfo.mode === 'in-memory') {
    const seedRes = await seedDatabase({ reset: false });
    if (!seedRes.skipped) {
      console.log('[Server] Auto-seeded in-memory database:', seedRes.counts);
    }
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[Server] Visitor Pass API listening on http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    console.log('[Server] Shutting down...');
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Server] Startup error:', err);
  process.exit(1);
});
