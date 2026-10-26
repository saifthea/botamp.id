import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

const PASSWORD = process.env.ADMIN_PASSWORD || "4321";

function verify(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("AdminSession ")) return false;
  try {
    const token = auth.replace("AdminSession ", "");
    const decoded = atob(token);
    const parts = decoded.split("-");
    if (parts.length !== 2) return false;
    return parts[1] === PASSWORD.slice(-2);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!verify(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { chatId, text } = body;

    if (!chatId || !text?.trim()) {
      return NextResponse.json({ error: "chatId dan text wajib diisi" }, { status: 400 });
    }

    // Pastikan chat document ada
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) {
      return NextResponse.json({ error: "Chat tidak ditemukan" }, { status: 404 });
    }

    // Kirim pesan
    const msgRef = await addDoc(collection(chatRef, "messages"), {
      sender: "admin",
      text: text.trim(),
      timestamp: serverTimestamp(),
      read: false,
    });

    // Update lastMessage
    await setDoc(chatRef, { lastMessage: text.trim() }, { merge: true });

    return NextResponse.json({ ok: true, messageId: msgRef.id });
  } catch (e: any) {
    console.error("Send admin message error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}