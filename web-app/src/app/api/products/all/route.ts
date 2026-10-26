/**
 * API: GET /api/products/all
 * Mendapatkan semua produk
 */
import { NextResponse } from "next/server";
import { db, collection, getDocs, query } from "@/lib/mongo";
import productsData from "@/products.json";

// Cache products di memory session
let productsCache: any[] | null = null;

export function resetProductsCache() {
  productsCache = null;
}

export async function GET() {
  try {
    // Coba dari cache dulu
    if (productsCache) {
      return NextResponse.json(productsCache);
    }

    // Ambil dari MongoDB
    const snapshot = await getDocs(query(collection(db, "products")));
    let products: any[];

    if (snapshot.docs.length > 0) {
      products = snapshot.docs.map((doc) => {
        const d = doc.data();
        const resolvedId = d.id_products || d.id || doc.id;
        return { ...d, id: resolvedId, variants: d.variants || [], images: d.images || [] };
      });
    } else {
      // Fallback ke static JSON
      products = productsData as any[];
    }

    // Sort by createdAt desc
    products.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dbb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dbb - da;
    });

    productsCache = products;
    return NextResponse.json(products);
  } catch (e: any) {
    console.error("[products/all] Error:", e?.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
