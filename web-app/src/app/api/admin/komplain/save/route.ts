import { NextResponse } from "next/server";
import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

export async function POST(req: Request) {
  console.log('[KOMPPLAIN SAVE] Request received');
  const body = await req.json();
  console.log('[KOMPPLAIN SAVE] Body:', body);
  const { orderId, customerName, customerPhone, complaintText } = body;

  if (!orderId || !complaintText?.trim()) {
    return NextResponse.json({ error: "Missing orderId or complaintText" }, { status: 400 });
  }

  try {
    // Cek apakah orderId sudah pernah diajukan komplain
    console.log('[KOMPPLAIN SAVE] Checking existing complaint for orderId:', orderId);
    const existingQ = query(
      collection(db, "komplain"),
      where("orderId", "==", orderId)
    );
    const existingSnap = await getDocs(existingQ);
    console.log('[KOMPPLAIN SAVE] Existing complaints found:', existingSnap.docs.length);
    if (existingSnap.docs.length > 0) {
      return NextResponse.json({ error: "Komplain untuk pesanan ini sudah pernah diajukan" }, { status: 409 });
    }

    // Simpan komplain baru dengan flag hasComplaint
    console.log('[KOMPPLAIN SAVE] Saving new complaint to Firestore');
    const docRef = await addDoc(collection(db, "komplain"), {
      orderId,
      customerName: customerName || "-",
      customerPhone: customerPhone || "-",
      complaintText: complaintText.trim(),
      status: "on_proses",
      adminNote: "",
      createdAt: serverTimestamp(),
    });
    console.log('[KOMPPLAIN SAVE] Complaint saved with ID:', docRef.id);

    // Tambahkan flag hasComplaint pada pesanan, JANGAN ubah status
    // Agar pesanan tetap di tab "Telah Diproses" dengan status "Printed"
    try {
      console.log('[KOMPPLAIN SAVE] Adding hasComplaint flag to order for orderId:', orderId);
      const pesananQ = query(
        collection(db, "pesanan"),
        where("orderId", "==", orderId)
      );
      const pesananSnap = await getDocs(pesananQ);
      console.log('[KOMPPLAIN SAVE] Orders found:', pesananSnap.docs.length);
      for (const p of pesananSnap.docs) {
        await updateDoc(doc(db, "pesanan", p.id), { hasComplaint: true });
        console.log('[KOMPPLAIN SAVE] Added hasComplaint flag to order doc:', p.id);
      }
    } catch (e) {
      console.error('[KOMPPLAIN SAVE] Gagal add hasComplaint flag:', e);
    }

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (e: any) {
    console.error('[KOMPPLAIN SAVE] Gagal simpan komplain:', e);
    console.error('[KOMPPLAIN SAVE] Error details:', {
      code: e?.code,
      message: e?.message,
      stack: e?.stack,
    });
    return NextResponse.json({ 
      error: "Internal server error", 
      details: e?.message || String(e)
    }, { status: 500 });
  }
}