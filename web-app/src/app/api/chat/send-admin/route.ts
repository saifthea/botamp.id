/**
 * API: POST /api/chat/send-admin
 * Admin mengirim pesan ke chat customer
 */
import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, addDoc, collection } from "@/lib/mongo";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chatId, text, sender = "admin" } = body as {
      chatId?: string;
      text?: string;
      sender?: string;
    };

    if (!chatId || !text?.trim()) {
      return NextResponse.json(
        { error: "Chat ID dan text diperlukan" },
        { status: 400 }
      );
    }

    // Pastikan chat document ada
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) {
      return NextResponse.json(
        { error: "Chat tidak ditemukan" },
        { status: 404 }
      );
    }

    // Kirim pesan ke collection messages global dengan field chatId
    await addDoc(collection(db, "messages"), {
      chatId,
      sender,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      read: false,
    });

    // Update lastMessage
    await setDoc(chatRef, { lastMessage: text.trim() }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[chat/send-admin] Error:", e?.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
