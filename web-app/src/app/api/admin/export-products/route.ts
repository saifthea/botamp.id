import { NextResponse } from "next/server";
import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

export async function GET(req: Request) {

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";
  const snapshot = await getDocs(query(collection(db, "products"), orderBy("sku")));

  // Data variants sudah ada di dalam dokumen products (field "variants")
  const products = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id_products || d.id,
      sku: data.sku,
      name: data.name,
      price: data.price,
      stock: data.stock,
      category: data.category || "",
      description: data.description || "",
      images: data.images || [],
      variants: Array.isArray(data.variants) ? data.variants : [],
    };
  });

  if (format === "json") {
    return NextResponse.json(products, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="produk.json"',
      },
    });
  }

  if (format === "csv") {
    // Cari max images dan max variants dari semua produk
    let maxImages = 0;
    let maxVariants = 0;
    for (const p of products) {
      const imgCount = (p.images || []).length;
      const varCount = (p.variants || []).length;
      if (imgCount > maxImages) maxImages = imgCount;
      if (varCount > maxVariants) maxVariants = varCount;
    }
    if (maxImages === 0) maxImages = 1;
    if (maxVariants === 0) maxVariants = 1;

    // Header dinamis sesuai data asli
    const headerRow: string[] = ["id_products", "name", "sku", "description", "category", "price", "stock"];
    for (let i = 1; i <= maxImages; i++) headerRow.push(`images${i}`);
    for (let vi = 0; vi < maxVariants; vi++) {
      headerRow.push("variants", "id", "name", "sku", "price", "stock", "weight");
    }

    const esc = (v: any) => {
      if (v == null) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const rows = products.map((p: any) => {
      const imgs = p.images || [];
      const vars = p.variants || [];
      const cells: string[] = [
        esc(p.id),
        esc(p.name),
        esc(p.sku),
        esc(p.description),
        esc(p.category),
        esc(p.price),
        esc(p.stock),
      ];
      // Image columns — dinamis sesuai jumlah gambar
      for (let i = 0; i < maxImages; i++) {
        cells.push(esc(imgs[i] || ""));
      }
      // Variant columns — dinamis sesuai jumlah varian
      for (let vi = 0; vi < maxVariants; vi++) {
        const v = vars[vi];
        if (v) {
          cells.push(esc(""));          // variants (kosong sesuai konsep CSV)
          cells.push(esc(v.id || ""));
          cells.push(esc(v.name || ""));
          cells.push(esc(v.sku || ""));
          cells.push(esc(v.price || ""));
          cells.push(esc(v.stock || ""));
          cells.push(esc(v.weight ?? ""));
        } else {
          for (let j = 0; j < 7; j++) cells.push("");
        }
      }
      return cells;
    });

    // Tambah BOM UTF-8 agar Excel membacanya benar
    const csv = "\uFEFF" + [headerRow.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="produk.csv"',
      },
    });
  }

  return NextResponse.json({ error: "Invalid format" }, { status: 400 });
}