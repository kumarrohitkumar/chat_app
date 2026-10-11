import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * One throwaway MongoDB for the whole run. Nothing is installed or left
 * behind, so `npm test` works on a laptop and in CI with no services.
 */
let mongo;

export async function setup() {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("chatify-test");
}

export async function teardown() {
  await mongo?.stop();
}
