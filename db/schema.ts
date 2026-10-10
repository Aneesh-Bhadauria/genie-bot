import { relations } from "drizzle-orm"
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { nanoid } from "nanoid"
import { z } from "zod"

export const bots = pgTable(
  "bots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user id
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    // seed for the bot's face
    avatar: text("avatar")
      .notNull()
      .$defaultFn(() => nanoid()),
    // what the bot is for, in a phrase
    job: text("job").notNull(),
    // how it should go about the job
    instructions: text("instructions"),
    // Daytona sandbox id, created with the bot and deleted with it
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("bots_user_id_idx").on(table.userId)]
)

export const chatKind = pgEnum("chat_kind", ["direct", "group"])

export const chats = pgTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user id
    userId: text("user_id").notNull(),
    kind: chatKind("kind").notNull().default("direct"),
    // null for direct chats, which use the bot's name
    name: text("name"),
    lastMessagePreview: text("last_message_preview"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("chats_user_id_idx").on(table.userId)]
)

export const chatMembers = pgTable(
  "chat_members",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.botId] }),
    index("chat_members_bot_id_idx").on(table.botId),
  ]
)

export const usageKind = pgEnum("usage_kind", ["ai", "sandbox"])

// What each user has consumed of their plan. Append-only: rows are never
// changed or removed, and the usage of a billing period is the sum of the
// rows created within it (see lib/usage.ts).
export const usageLedger = pgTable(
  "usage_ledger",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user id
    userId: text("user_id").notNull(),
    kind: usageKind("kind").notNull(),
    // ai: micro-dollars of model cost for one turn
    // sandbox: seconds one sandbox was running
    amount: integer("amount").notNull(),
    // What the usage was for. Not foreign keys: the entry has to outlive the
    // bot or chat it was for.
    botId: text("bot_id"),
    chatId: text("chat_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_ledger_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
  ]
)

export const botsRelations = relations(bots, ({ many }) => ({
  memberships: many(chatMembers),
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
}))

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMembers.chatId],
    references: [chats.id],
  }),
  bot: one(bots, {
    fields: [chatMembers.botId],
    references: [bots.id],
  }),
}))

export const botInsertSchema = createInsertSchema(bots, {
  name: (schema) =>
    schema
      .trim()
      .min(1, "Give your bot a name.")
      .max(40, "Keep the name under 40 characters."),
  avatar: (schema) => schema.min(1).max(64),
  job: (schema) =>
    schema
      .trim()
      .min(1, "Tell the bot what its job is.")
      .max(80, "Keep the job under 80 characters."),
  instructions: (schema) =>
    schema.trim().max(2000, "Keep the instructions under 2000 characters."),
}).omit({ id: true, userId: true, sandboxId: true, createdAt: true })

export type BotInsert = z.infer<typeof botInsertSchema>

// A group chat is a chat plus the bots in it, so the form adds `botIds` to
// the chat's own columns. `name` is nullable for direct chats but a group
// has to have one, hence the full schema instead of a refinement.
export const groupChatInsertSchema = createInsertSchema(chats, {
  name: z
    .string()
    .trim()
    .min(1, "Give the group a name.")
    .max(40, "Keep the name under 40 characters."),
})
  .omit({
    id: true,
    userId: true,
    kind: true,
    lastMessagePreview: true,
    lastMessageAt: true,
    createdAt: true,
  })
  .extend({
    botIds: z.array(z.string()).min(2, "Pick at least two bots."),
  })

export type GroupChatInsert = z.infer<typeof groupChatInsertSchema>
