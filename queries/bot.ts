import { auth } from "@clerk/nextjs/server"
import { asc, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { bots, chatMembers, chats } from "@/db/schema"

// The signed-in user's chats with their bots, most recently active first.
export async function getChats() {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated) {
    throw new Error("You must be signed in to list chats.")
  }

  return db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: desc(chats.lastMessageAt),
    with: {
      members: {
        orderBy: asc(chatMembers.joinedAt),
        with: {
          bot: { columns: { id: true, name: true, avatar: true } },
        },
      },
    },
  })
}

// The signed-in user's bots, oldest first.
export async function getBots() {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated) {
    throw new Error("You must be signed in to list bots.")
  }

  return db.query.bots.findMany({
    where: eq(bots.userId, userId),
    orderBy: asc(bots.createdAt),
    columns: { id: true, name: true, avatar: true },
  })
}
