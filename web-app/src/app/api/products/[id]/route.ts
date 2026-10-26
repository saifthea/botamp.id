/**
 * API: GET /api/products/[id]
 * Mendapatkan detail produk berdasarkan ID
 */
import { NextResponse } from "next/server";
import { db, doc, getDoc } from "@/lib/mongo";
import productsData from "@/products.json";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Coba dari MongoDB dulu
    const docRef = doc(db, "products", id);
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      const d = snapshot.data();
      const resolvedId = d.id_products || d.id || id;
      return NextResponse.json({
        id: resolvedId,
        ...d,
        variants: d.variants || [],
        images: d.images || [],
      });
    }

    // Fallback ke static JSON
    const product = (productsData as any[]).find((p) => p.id === id);
    if (product) {
      return NextResponse.json(product);
    }

    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  } catch (e: any) {
    console.error("[products/id] Error:", e?.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
