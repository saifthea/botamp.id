/**
 * API: POST /api/products/delete
 * Menghapus product berdasarkan ID
 */
import { NextResponse } from "next/server";
import { db, doc, deleteDoc, getDoc } from "@/lib/mongo";
import { resetProductsCache } from "@/app/api/products/all/route";

interface DeleteBody {
  id: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as DeleteBody;
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    const docRef = doc(db, "products", id);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }

    await deleteDoc(docRef);
    resetProductsCache();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[products/delete] Error:", e?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}