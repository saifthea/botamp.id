import { NextResponse } from "next/server";
import { db, doc, getDoc, updateDoc, collection, query, where, getDocs } from "@/lib/mongo";

async function toggleProductActive(id: string, isActive: boolean): Promise<boolean> {
  // Try direct doc ID first
  const directSnap = await getDoc(doc(db, "products", id));
  if (directSnap.exists()) {
    await updateDoc(doc(db, "products", id), { isActive, updatedAt: new Date().toISOString() });
    return true;
  }
  // Query by id_products field
  const q = query(collection(db, "products"), where("id_products", "==", id));
  const snap = await getDocs(q);
  if (!snap.docs.length) {
    // Fallback: query by id field
    const q2 = query(collection(db, "products"), where("id", "==", id));
    const snap2 = await getDocs(q2);
    if (!snap2.docs.length) return false;
    const d = snap2.docs[0];
    await updateDoc(doc(db, "products", d.id), { isActive, updatedAt: new Date().toISOString() });
    return true;
  }
  const d = snap.docs[0];
  await updateDoc(doc(db, "products", d.id), { isActive, updatedAt: new Date().toISOString() });
  return true;
}

export async function POST(req: Request) {
  try {
    const { id_products, isActive } = await req.json();
    console.log("[API toggle-product-active] Received:", { id_products, isActive });
    if (!id_products || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Missing id_products or isActive" }, { status: 400 });
    }
    const ok = await toggleProductActive(id_products, isActive);
    console.log("[API toggle-product-active] toggleProductActive result:", ok);
    if (!ok) {
      return NextResponse.json({ error: "Product not found or update failed" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, isActive });
  } catch (e: any) {
    console.error("[API toggle-product-active] Error:", e);
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}