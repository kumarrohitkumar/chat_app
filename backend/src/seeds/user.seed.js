/**
 * Demo data. Run with:  npm run seed  (from backend/)
 *
 * Idempotent: re-running updates the same accounts and rebuilds the seeded
 * conversations from scratch rather than duplicating them.
 *
 * The old version wrote passwords in plain text, so none of the seeded
 * accounts could actually sign in — login compares a bcrypt hash.
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../lib/db.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";

const DEMO_PASSWORD = "demo1234";

const people = [
  { fullName: "Ananya Sharma", email: "ananya@demo.chat", pic: "women/44" },
  { fullName: "Rahul Verma", email: "rahul@demo.chat", pic: "men/32" },
  { fullName: "Priya Nair", email: "priya@demo.chat", pic: "women/68" },
  { fullName: "Arjun Mehta", email: "arjun@demo.chat", pic: "men/75" },
  { fullName: "Sneha Iyer", email: "sneha@demo.chat", pic: "women/12" },
  { fullName: "Vikram Singh", email: "vikram@demo.chat", pic: "men/19" },
];

const directScript = [
  ["Ananya Sharma", "Hey Rahul, did the deploy go out?"],
  ["Rahul Verma", "Yes, about twenty minutes ago. Health check is green."],
  ["Ananya Sharma", "Nice. Any errors in the logs?"],
  ["Rahul Verma", "Nothing so far. Rate limiter is holding at about 4 requests a second."],
  ["Ananya Sharma", "Good. I will run through the signup flow once more and sign off."],
  ["Rahul Verma", "Sounds good. I will keep an eye on the dashboard till evening."],
];

const groupScript = [
  [null, "Ananya Sharma created “Release Crew”"],
  ["Ananya Sharma", "Morning everyone. Release window is 4pm today."],
  ["Priya Nair", "Frontend build is tagged and ready."],
  ["Arjun Mehta", "Migrations ran clean on staging. 41 tests green."],
  ["Rahul Verma", "I will take the deploy. Priya, can you watch the error rate after?"],
  ["Priya Nair", "Yes, I will keep the dashboard open."],
  ["Ananya Sharma", "Perfect. Let us regroup here at 5."],
];

/** Insert a scripted exchange, spaced a few minutes apart. */
async function writeScript(conversation, script, byName, endingAt) {
  const gapMs = 4 * 60 * 1000;
  const start = endingAt - script.length * gapMs;

  const docs = script.map(([author, text], index) => {
    const at = new Date(start + index * gapMs);
    return {
      conversationId: conversation._id,
      senderId: author ? byName.get(author)._id : undefined,
      system: !author,
      text,
      createdAt: at,
      updatedAt: at,
    };
  });

  await Message.insertMany(docs);

  const last = docs[docs.length - 1];
  conversation.lastMessageAt = last.createdAt;
  conversation.lastMessage = {
    text: last.text,
    senderId: last.senderId ?? null,
    hasImage: false,
    system: Boolean(last.system),
  };
  // Everyone has read the backlog, so the demo opens without unread badges.
  conversation.members.forEach((member) => {
    member.lastReadAt = last.createdAt;
  });
  await conversation.save();
}

async function seed() {
  await connectDB();

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  const byName = new Map();

  for (const person of people) {
    const user = await User.findOneAndUpdate(
      { email: person.email },
      {
        $set: {
          fullName: person.fullName,
          password: hashedPassword,
          profilePic: `https://randomuser.me/api/portraits/${person.pic}.jpg`,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    byName.set(person.fullName, user);
  }

  const ids = [...byName.values()].map((u) => u._id);

  // Rebuild rather than append, so repeated runs stay identical.
  const existing = await Conversation.find({ "members.user": { $in: ids } }).select("_id");
  await Message.deleteMany({ conversationId: { $in: existing.map((c) => c._id) } });
  await Conversation.deleteMany({ _id: { $in: existing.map((c) => c._id) } });

  const ananya = byName.get("Ananya Sharma");
  const rahul = byName.get("Rahul Verma");

  const direct = await Conversation.create({
    type: "direct",
    directKey: Conversation.buildDirectKey(ananya._id, rahul._id),
    createdBy: ananya._id,
    members: [{ user: ananya._id }, { user: rahul._id }],
  });
  await writeScript(direct, directScript, byName, Date.now());

  const group = await Conversation.create({
    type: "group",
    name: "Release Crew",
    createdBy: ananya._id,
    members: [
      { user: ananya._id, role: "admin" },
      { user: rahul._id },
      { user: byName.get("Priya Nair")._id },
      { user: byName.get("Arjun Mehta")._id },
    ],
  });
  await writeScript(group, groupScript, byName, Date.now() - 2 * 60 * 1000);

  console.log(`\nSeeded ${people.length} accounts, 1 direct chat and 1 group ("Release Crew").`);
  console.log(`Sign in with any of these and the password "${DEMO_PASSWORD}":\n`);
  for (const person of people) console.log(`  ${person.email}`);
  console.log();

  await disconnectDB();
}

seed().catch(async (error) => {
  console.error("Seed failed:", error.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
