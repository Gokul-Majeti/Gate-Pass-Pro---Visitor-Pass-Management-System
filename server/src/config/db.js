import mongoose from 'mongoose';
import { env } from './env.js';

let memoryServerInstance = null;
let activeMode = 'disconnected';

/**
 * Starts an in-memory MongoDB server instance for local development or automated tests.
 */
async function startMemoryServer() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServerInstance = await MongoMemoryServer.create({
    instance: {
      dbName: 'visitor_pass_db',
      launchTimeout: 30000,
    },
  });
  return memoryServerInstance.getUri();
}

function redactMongoUri(uri) {
  return String(uri).replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
}

/**
 * Connects Mongoose to the configured MongoDB URI, falling back to an in-memory
 * MongoDB server in non-production mode when local MongoDB is unreachable.
 */
export async function connectDB(options = {}) {
  if (mongoose.connection.readyState === 1) {
    return { mode: activeMode, uri: mongoose.connection.host };
  }

  const forceInMemory =
    options.useInMemory ?? (env.useInMemoryDb || process.env.USE_IN_MEMORY_DB === 'true');

  if (forceInMemory) {
    const uri = await startMemoryServer();
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    activeMode = 'in-memory';
    return { mode: activeMode, uri };
  }

  try {
    await mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    activeMode = 'external';
    return { mode: activeMode, uri: env.mongodbUri };
  } catch (err) {
    if (!env.isProduction && env.allowMemoryDbFallback) {
      console.warn(
        `[DB] Could not connect to ${redactMongoUri(env.mongodbUri)} (${err.message}). Falling back to in-memory MongoDB...`
      );
      const uri = await startMemoryServer();
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      activeMode = 'in-memory';
      return { mode: activeMode, uri };
    }
    throw err;
  }
}

/**
 * Returns the active database connection mode ('external' | 'in-memory' | 'disconnected').
 */
export function getDatabaseMode() {
  if (mongoose.connection.readyState !== 1) return 'disconnected';
  return activeMode;
}

/**
 * Gracefully disconnects Mongoose and shuts down any active in-memory MongoDB instance.
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
    memoryServerInstance = null;
  }
  activeMode = 'disconnected';
}
