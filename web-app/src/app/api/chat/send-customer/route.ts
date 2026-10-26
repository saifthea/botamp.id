import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, addDoc, collection, query, where, serverTimestamp, Timestamp } from "@/lib/mongo";

/**
 * API: POST /api/chat/send
 * Send a message from customer to chat session
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chatId, text, userName, userPhone } = body || {};

    if (!chatId || !text?.trim()) {
      return NextResponse.json({ error: "chatId and text are required" }, { status: 400 });
    }

    const chatRef = doc(db, "chats", chatId);
    
    // Create chat if not exists
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        userId: chatId,
        userName: userName || "Tamu",
        userPhone: userPhone || chatId,
        status: "open",
        createdAt: serverTimestamp(),
        lastMessage: "",
      }, { merge: true });
    }

    // Kirim pesan ke collection messages global dengan field chatId
    await addDoc(collection(db, "messages"), {
      chatId,
      sender: "customer",
      text: text.trim(),
      timestamp: new Date().toISOString(),
      read: false,
    });

    // Update lastMessage
    await setDoc(chatRef, { lastMessage: text.trim() }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[chat/send] Error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
