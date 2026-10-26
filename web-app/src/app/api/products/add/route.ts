/**
 * API: POST /api/products/add
 * Menambah product baru
 */
import { NextResponse } from "next/server";
import { db, doc, setDoc } from "@/lib/mongo";
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
    const { id, ...productData } = body;

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    const docRef = doc(db, "products", id);
    await setDoc(docRef, { ...productData, id_products: id, id: id }, { merge: true });
    resetProductsCache();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[products/add] Error:", e?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}