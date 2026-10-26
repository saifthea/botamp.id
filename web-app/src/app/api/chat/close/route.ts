/**
 * API: POST /api/chat/close
 * Menutup chat
 */
import { NextResponse } from "next/server";
import { db, doc, setDoc } from "@/lib/mongo";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chatId } = body as { chatId?: string };

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID diperlukan" },
        { status: 400 }
      );
    }

    await setDoc(doc(db, "chats", chatId), { status: "closed" }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[chat/close] Error:", e?.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
