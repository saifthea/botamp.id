/**
 * API: POST /api/products/update
 * Mengupdate product berdasarkan ID
 */
import { NextResponse } from "next/server";
import { db, doc, updateDoc, getDoc } from "@/lib/mongo";
import { resetProductsCache } from "@/app/api/products/all/route";

interface ProductBody {
  id: string;
  name?: string;
  sku?: string;
  description?: string;
  category?: string;
  price?: number;
  stock?: number;
  images?: string[];
  variants?: { id: string; name: string; sku: string; price: number; stock: number; weight: number }[];
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as ProductBody;
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    // Cari product berdasarkan id_products
    const docRef = doc(db, "products", id);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }

    await updateDoc(docRef, updateData);
    resetProductsCache();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[products/update] Error:", e?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}