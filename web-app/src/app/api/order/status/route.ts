import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  try {
    const orderDoc = await getDoc(doc(db, "pesanan", orderId));
    if (!orderDoc.exists()) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: orderDoc.data() });
  } catch (e: any) {
    console.error("Check order status error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}