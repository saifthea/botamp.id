import { NextResponse } from "next/server";
import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, customerPhone } = body;

    if (!orderId || !customerPhone) {
      return NextResponse.json({ error: "Missing orderId or customerPhone" }, { status: 400 });
    }

    const cleanPhone = customerPhone.replace(/\D/g, "");

    // Cari pesanan milik customer ini
    const q = query(
      collection(db, "pesanan"),
      where("orderId", "==", orderId),
      where("customerPhone", "==", cleanPhone)
    );
    const snap = await getDocs(q);

    if (snap.docs.length === 0) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }

    for (const p of snap.docs) {
      await updateDoc(doc(db, "pesanan", p.id), { customerMarkedDone: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Gagal tandai selesai:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}