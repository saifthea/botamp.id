import { NextResponse } from "next/server";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

export async function POST(req: Request) {
  // Rate limiting: max 20 check attempts per minute per IP
  const rateLimitResponse = rateLimitMiddleware(req, 20, 60 * 1000);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = await req.json();
  const PASSWORD = process.env.ADMIN_PASSWORD || "4321";
  if (body.password === PASSWORD) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}