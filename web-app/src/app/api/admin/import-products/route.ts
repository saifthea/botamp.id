import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"
import { isValidToken } from "@/app/api/admin/session/route";

async function verify(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("AdminSession ")) return false;
  const token = auth.replace("AdminSession ", "");
  return await isValidToken(token);
}

export async function POST(req: Request) {
  if (!await verify(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const text = await file.text();
    const products = JSON.parse(text);

    if (!Array.isArray(products)) {
      return NextResponse.json({ error: "Format salah, harus array" }, { status: 400 });
    }

    let added = 0;
    let updated = 0;

    for (const p of products) {
      const id = p.id?.toString() || p.sku?.toString();
      if (!id) continue;

      const docRef = doc(db, "products", id);
      const existing = await getDoc(docRef);

      if (existing.exists()) {
        // Update: gabungkan data lama + baru
        const old = existing.data() as any;
        await setDoc(docRef, {
          ...old,
          ...p,
          variants: p.variants || old.variants,
          images: p.images || old.images,
          updatedAt: new Date().toISOString(),
        });
        updated++;
      } else {
        await setDoc(docRef, {
          ...p,
          id: p.id?.toString(),
          sku: p.sku?.toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        added++;
      }
    }

    return NextResponse.json({
      ok: true,
      addedProducts: added,
      updatedProducts: updated,
    });
  } catch (e: any) {
    console.error("Import JSON error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}