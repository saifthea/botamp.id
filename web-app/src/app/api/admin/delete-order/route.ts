import { NextResponse } from "next/server";
import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

const DELETE_PASSWORD = process.env.ADMIN_DELETED_PASSWORD || "";

export async function POST(req: Request) {
  const body = await req.json();
  const { orderId, password } = body;

  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const cleanPassword = password?.trim();
  console.log('Delete order attempt:', { orderId, passwordReceived: !!cleanPassword, passwordMatch: cleanPassword === DELETE_PASSWORD, envPassword: DELETE_PASSWORD });
  
  if (!cleanPassword || cleanPassword !== DELETE_PASSWORD) {
    return NextResponse.json({ error: "Password salah" }, { status: 403 });
  }

  const q = query(collection(db, "pesanan"), where("orderId", "==", orderId));
  const snapshot = await getDocs(q);

  if (snapshot.docs.length === 0) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  await deleteDoc(doc(db, "pesanan", snapshot.docs[0].id));
  return NextResponse.json({ ok: true });
}