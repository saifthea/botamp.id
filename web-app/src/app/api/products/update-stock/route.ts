/**
 * API: POST /api/products/update-stock
 * Mengupdate stok produk
 */
import { NextResponse } from "next/server";
import { db, collection, getDocs, query, where, doc, updateDoc, getDoc } from "@/lib/mongo";
import { resetProductsCache } from "@/app/api/products/all/route";

interface StockUpdateItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, mode } = body as { items: StockUpdateItem[]; mode?: "decrease" | "restore" };
    const restore = mode === "restore";

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Items diperlukan" },
        { status: 400 }
      );
    }

    for (const item of items) {
      // Cari product berdasarkan id_products
      let q = query(collection(db, "products"), where("id_products", "==", item.productId));
      let snap = await getDocs(q);

      if (snap.docs.length === 0) {
        // Coba berdasarkan doc ID langsung
        const directSnap = await getDoc(doc(db, "products", item.productId));
        if (directSnap.exists()) {
          const productRef = doc(db, "products", item.productId);
          const data = directSnap.data();

          if (item.variantId) {
            const variants = data.variants || [];
            const variant = variants.find((v: any) => v.sku === item.variantId);
            if (variant) {
              variant.stock = restore
                ? (variant.stock || 0) + item.quantity
                : Math.max(0, (variant.stock || 0) - item.quantity);
            }
            const totalStock = variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
            await updateDoc(productRef, { variants, stock: totalStock });
          } else {
            const newStock = restore
              ? (data.stock || 0) + item.quantity
              : Math.max(0, (data.stock || 0) - item.quantity);
            await updateDoc(productRef, { stock: newStock });
          }
        }
        continue;
      }

      const docSnap = snap.docs[0];
      const productRef = doc(db, "products", docSnap.id);
      const data = docSnap.data();

      if (item.variantId) {
        const variants = data.variants || [];
        const variant = variants.find((v: any) => v.sku === item.variantId);
        if (variant) {
          variant.stock = restore
            ? (variant.stock || 0) + item.quantity
            : Math.max(0, (variant.stock || 0) - item.quantity);
        }
        // Hitung total stok dari semua varian
        const totalStock = variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
        await updateDoc(productRef, { variants, stock: totalStock });
      } else {
        const newStock = restore
          ? (data.stock || 0) + item.quantity
          : Math.max(0, (data.stock || 0) - item.quantity);
        await updateDoc(productRef, { stock: newStock });
      }
  }

  resetProductsCache();
  return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[products/update-stock] Error:", e?.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
