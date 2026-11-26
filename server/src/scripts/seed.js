import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { seedDatabase } from './seedData.js';

async function runSeed() {
  try {
    const dbInfo = await connectDB();
    console.log(`[Seed] Connected to MongoDB (${dbInfo.mode})`);

    if (
      dbInfo.mode === 'in-memory' &&
      !env.useInMemoryDb &&
      env.mongodbUri.startsWith('mongodb+srv://')
    ) {
      console.warn(
        '[Seed] WARNING: Configured MongoDB Atlas cluster was unreachable (verify IP whitelist). Seeded ephemeral in-memory DB only.'
      );
    }

    const result = await seedDatabase({ reset: true });
    console.log('[Seed] Seed completed successfully:', result.counts);
    console.table(result.demoCredentials);
  } catch (err) {
    console.error('[Seed] Failed:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

runSeed();
