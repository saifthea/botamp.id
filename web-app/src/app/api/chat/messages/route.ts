import { NextResponse } from "next/server";
import { db, doc, getDoc, getDocs, collection, query, where } from "@/lib/mongo";

/**
 * API: POST /api/chat/messages
 * Get messages for a chat session (last N minutes)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chatId, minutes = 5 } = body || {};

    if (!chatId) {
      return NextResponse.json({ error: "chatId is required" }, { status: 400 });
    }

    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) {
      return NextResponse.json({ messages: [] });
    }

    // Jika minutes > 0, filter berdasarkan waktu; jika 0 atau tidak ada, ambil semua
    const useTimeFilter = minutes > 0;
    const since = useTimeFilter ? new Date(Date.now() - minutes * 60 * 1000).toISOString() : null;

    // Query messages collection
    const msgsCollection = collection(db, "messages");
    const q = query(msgsCollection, where("chatId", "==", chatId));
    const snap = await getDocs(q);

    const messages = snap.docs
      .map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          chatId: data.chatId || "",
          sender: data.sender,
          text: data.text,
          timestamp: data.timestamp,
          read: data.read || false,
        };
      })
      .filter((m: any) => !useTimeFilter || !m.timestamp || (since && m.timestamp >= since));

    return NextResponse.json({ messages });
  } catch (e: any) {
    console.error("[chat/messages] Error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}