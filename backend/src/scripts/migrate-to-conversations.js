/**
 * One-off migration for databases written before group chat existed, when a
 * message carried `senderId` + `receiverId` and there was no Conversation
 * collection.
 *
 *   node src/scripts/migrate-to-conversations.js [--dry-run]
 *
 * Safe to run twice: messages that already have a conversationId are skipped.
 */
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../lib/db.js";
import Conversation from "../models/conversation.model.js";

/**
 * Assumes an open mongoose connection, so the test suite can drive it directly.
 * Returns a summary rather than printing, and reports instead of writing when
 * `dryRun` is set.
 */
export async function runMigration({ dryRun = false, log = () => {} } = {}) {
  // Work on the raw collection: these documents no longer fit the model.
  const messages = mongoose.connection.collection("messages");

  const legacy = await messages
    .find({ receiverId: { $exists: true }, conversationId: { $exists: false } })
    .toArray();

  if (legacy.length === 0) {
    log("Nothing to migrate — no legacy messages found.");
    return { found: 0, conversations: 0, migrated: 0, dryRun };
  }

  log(`Found ${legacy.length} legacy message(s).`);

  // Group them by the pair they belong to.
  const pairs = new Map();
  for (const message of legacy) {
    const key = Conversation.buildDirectKey(message.senderId, message.receiverId);
    if (!pairs.has(key)) {
      pairs.set(key, { ids: [message.senderId, message.receiverId], messages: [] });
    }
    pairs.get(key).messages.push(message);
  }

  log(`They belong to ${pairs.size} direct conversation(s).`);

  if (dryRun) {
    log("\n--dry-run: nothing was written.");
    return { found: legacy.length, conversations: pairs.size, migrated: 0, dryRun: true };
  }

  let migrated = 0;

  for (const [directKey, { ids, messages: group }] of pairs) {
    group.sort((a, b) => a.createdAt - b.createdAt);
    const newest = group[group.length - 1];

    const conversation =
      (await Conversation.findOne({ directKey })) ??
      (await Conversation.create({
        type: "direct",
        directKey,
        createdBy: ids[0],
        // Read state is unknown for old data, so start everyone at "all read"
        // rather than showing a wall of false unread badges.
        members: ids.map((user) => ({ user, lastReadAt: newest.createdAt })),
        lastMessageAt: newest.createdAt,
        lastMessage: {
          text: newest.text ?? "",
          senderId: newest.senderId,
          hasImage: Boolean(newest.image),
          system: false,
        },
      }));

    const result = await messages.updateMany(
      { _id: { $in: group.map((m) => m._id) } },
      { $set: { conversationId: conversation._id }, $unset: { receiverId: "", readAt: "" } }
    );

    migrated += result.modifiedCount;
  }

  log(`\nMigrated ${migrated} message(s) into ${pairs.size} conversation(s).`);

  return { found: legacy.length, conversations: pairs.size, migrated, dryRun: false };
}

/** CLI entry point. Skipped when this module is imported by a test. */
const isCli = process.argv[1]?.endsWith("migrate-to-conversations.js");

if (isCli) {
  const dryRun = process.argv.includes("--dry-run");

  connectDB()
    .then(() => runMigration({ dryRun, log: console.log }))
    .then(() => disconnectDB())
    .catch(async (error) => {
      console.error("Migration failed:", error.message);
      await mongoose.connection.close().catch(() => {});
      process.exit(1);
    });
}
