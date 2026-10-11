import { afterAll, beforeAll, beforeEach } from "vitest";
import mongoose from "mongoose";

// Set before any application module reads the environment.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "test-secret-0123456789abcdef0123456789abcdef";

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
});

beforeEach(async () => {
  // Each test starts from an empty database rather than inheriting whatever
  // the previous one left behind.
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.close();
});
