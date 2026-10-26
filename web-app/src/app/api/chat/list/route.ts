/**
 * API: POST /api/chat/list
 * Mendapatkan daftar chat (semua customer yang pernah chat)
 */
import { NextResponse } from "next/server";
import { db, collection, query, where, getDocs } from "@/lib/mongo";

export async function POST(req: Request) {
  try {
    const chatsCollection = collection(db, "chats");
    const q = query(chatsCollection);
    const snap = await getDocs(q);

    const chats: any[] = [];
    snap.docs.forEach((d: any) => {
      const data = d.data();
      chats.push({ id: d.id, ...data });
    });

    return NextResponse.json({ chats });
  } catch (e: any) {
    console.error("[chat/list] Error:", e?.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
