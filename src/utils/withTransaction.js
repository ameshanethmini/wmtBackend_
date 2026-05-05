import mongoose from 'mongoose';

/**
 * Run fn inside a MongoDB transaction. Session is passed as first arg to fn.
 * @param {function(session): Promise<any>} fn
 * @returns {Promise<any>}
 */
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    // Standalone MongoDB doesn't support transactions.
    // This error message is common for that scenario.
    const message = String(err?.message || err);
    const isReplicaSetRequired =
      message.includes('Transaction numbers are only allowed on a replica set member or mongos');

    if (isReplicaSetRequired) {
      session.endSession();
      // Run without transaction so app can still function on standalone MongoDB.
      return fn(null);
    }

    try {
      await session.abortTransaction();
    } catch {
      // Ignore abort errors; original error is more important.
    }
    throw err;
  } finally {
    // `endSession()` is safe to call even after the early path above.
    try {
      session.endSession();
    } catch {
      // no-op
    }
  }
}
