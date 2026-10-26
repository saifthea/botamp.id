import { NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

export async function POST(req: Request) {
  // Rate limiting: max 10 verify-delete attempts per minute per IP
  const rateLimitResponse = rateLimitMiddleware(req, 10, 60 * 1000);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await req.json();
    const PASSWORD = process.env.ADMIN_DELETED_PASSWORD || "";
    if (!PASSWORD) {
      return NextResponse.json({ ok: false, error: "Not configured" }, { status: 500 });
    }
    console.log('Verify delete attempt:', { received: body.password, expected: PASSWORD });
    if (body.password === PASSWORD) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}