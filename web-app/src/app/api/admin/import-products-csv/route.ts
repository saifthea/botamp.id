import { NextResponse } from "next/server";
import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

// Parse satu baris CSV (bisa multiline karena field quoted)
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    while (i < line.length && line[i] === " ") i++;
    if (i >= line.length) break;

    let field = "";
    if (line[i] === '"') {
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            field += '"'; i += 2;
          } else {
            i++; break;
          }
        } else {
          field += line[i]; i++;
        }
      }
      while (i < line.length && line[i] !== ",") i++;
    } else {
      while (i < line.length && line[i] !== ",") {
        field += line[i]; i++;
      }
    }
    fields.push(field.trim());
    if (i < line.length && line[i] === ",") i++;
  }
  return fields;
}

function cleanField(val: string): string {
  return val.replace(/^"|"$/g, "").trim();
}

// Shopee CSV format: setiap produk bisa multi-baris karena deskripsi quoted.
// Baris yang diawali angka 10+ digit = awal produk baru.
// Baris selanjutnya (tanpa angka di depan) = lanjutan deskripsi + sisa data produk (harga, stok, gambar, variant).
// Output: satu objek per produk, dengan fields: id, sku, name, description, images[], price, stock, category, + variantId[], variantName[], dll.
function parseCSV(text: string): Record<string, string>[] {
  const cleanText = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = cleanText.split("\n");
  if (lines.length === 0) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  headers.forEach((h, i) => { headers[i] = cleanField(h); });

  // Find variant section start indices
  const variantSections: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] === "variants") variantSections.push(i);
  }

  // Group lines into products
  // A product block starts at a line that begins with 10+ digit number
  // Continuation lines (multiline description) go with the previous product
  const productBlocks: string[][] = [];
  let currentBlock: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (/^\d{10,}/.test(trimmed)) {
      if (currentBlock.length > 0) productBlocks.push(currentBlock);
      currentBlock = [trimmed];
    } else {
      currentBlock.push(trimmed);
    }
  }
  if (currentBlock.length > 0) productBlocks.push(currentBlock);

  // Merge each block into one line and parse
  const rows: Record<string, string>[] = [];
  for (const block of productBlocks) {
    const merged = block.join("\n");
    const row = parseCSVLine(merged);

    const obj: Record<string, string> = {};
    const productEnd = variantSections.length > 0 ? variantSections[0] : headers.length;

    // Product-level fields
    for (let i = 0; i < productEnd && i < row.length; i++) {
      const h = headers[i];
      const val = cleanField(row[i] || "");
      if (h.startsWith("images")) {
        if (!obj["images"]) obj["images"] = "";
        if (val) obj["images"] += (obj["images"] ? "|" : "") + val;
      } else {
        obj[h] = val;
      }
    }

    // Variant fields from all sections
    for (let s = 0; s < variantSections.length; s++) {
      const start = variantSections[s];
      const end = s + 1 < variantSections.length ? variantSections[s + 1] : headers.length;
      const sectionHeaders = headers.slice(start, end);
      const sectionValues = row.slice(start, end);
      const vobj: Record<string, string> = {};
      sectionHeaders.forEach((h, idx) => {
        vobj[h] = cleanField(sectionValues[idx] || "");
      });

      if (vobj["id"]) {
        if (!obj["variant_id"]) obj["variant_id"] = vobj["id"];
        else obj["variant_id"] += "|" + vobj["id"];
        if (!obj["variant_name"]) obj["variant_name"] = vobj["name"] || "";
        else obj["variant_name"] += "|" + (vobj["name"] || "");
        if (!obj["variant_sku"]) obj["variant_sku"] = vobj["sku"] || "";
        else obj["variant_sku"] += "|" + (vobj["sku"] || "");
        if (!obj["variant_price"]) obj["variant_price"] = vobj["price"] || "";
        else obj["variant_price"] += "|" + (vobj["price"] || "");
        if (!obj["variant_stock"]) obj["variant_stock"] = vobj["stock"] || "";
        else obj["variant_stock"] += "|" + (vobj["stock"] || "");
        if (!obj["variant_weight"]) obj["variant_weight"] = vobj["weight"] || "";
        else obj["variant_weight"] += "|" + (vobj["weight"] || "");
      }
    }

    if (obj["id"] || obj["sku"]) rows.push(obj);
  }

  return rows;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const text = await file.text();
    const rows = parseCSV(text);
    console.log("CSV parsed rows:", rows.length);

    // Group by product ID — build list of variant objects per product
    const productMap = new Map<string, any>();
    for (const row of rows) {
      const productId = (row["id_products"] || row["id"] || "").trim();
      if (!productId) continue;

      let product = productMap.get(productId);
      if (!product) {
        const images: string[] = row["images"]
          ? row["images"].split("|").filter((u: string) => u.trim())
          : [];
        product = {
          id_products: productId,
          sku: row["sku"] || productId,
          name: row["name"] || "",
          description: row["description"] || "",
          category: row["category"] || "",
          price: Number(row["price"]) || 0,
          images,
          variants: [] as any[],
        };
        productMap.set(productId, product);
      }

      // Variants — bisa ada banyak (pipe-separated), urut sesuai section di CSV
      const variantIdStr = (row["variant_id"] || "").trim();
      if (!variantIdStr) continue;

      const vIds = variantIdStr.split("|").map((s: string) => s.trim()).filter(Boolean);
      const vNames = (row["variant_name"] || "").split("|").map((s: string) => s.trim());
      const vSkus = (row["variant_sku"] || "").split("|").map((s: string) => s.trim());
      const vPrices = (row["variant_price"] || "").split("|").map((s: string) => Number(s) || 0);
      const vStocks = (row["variant_stock"] || "").split("|").map((s: string) => Number(s) || 0);
      const vWeights = (row["variant_weight"] || "").split("|").map((s: string) => Number(s) || 200);
      const imgArray = product.images;

      for (let i = 0; i < vIds.length; i++) {
        product.variants.push({
          id: vIds[i],
          name: vNames[i] || "Variant",
          sku: vSkus[i] || vIds[i],
          price: vPrices[i] || 0,
          stock: vStocks[i] || 0,
          weight: vWeights[i] || 200,
          image: imgArray[i] || imgArray[0] || "",
        });
      }
    }

    console.log("Products to process:", productMap.size);

    let added = 0;
    let updated = 0;

    for (const [id, product] of productMap) {
      // Cari dokumen yang ada berdasarkan field id_products
      const q = query(collection(db, "products"), where("id_products", "==", id));
      const snap = await getDocs(q);
      let existingDoc: any = null;
      let existingData: any = null;
      if (snap.docs.length > 0) {
        existingDoc = snap.docs[0] as any;
        existingData = (existingDoc as any).data();
      }

      if (existingDoc) {
        // Ganti seluruh data dengan data dari CSV (timpa yang lama)
        const stockTotal = product.variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
        const updatedData: any = {
          ...existingData,
          id_products: product.id_products,
          sku: product.sku,
          name: product.name,
          description: product.description,
          category: product.category,
          price: product.price,
          images: product.images,
          variants: product.variants,
          stock: stockTotal,
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "products", existingDoc.id), updatedData);
        updated++;
      } else {
        const stockTotal = product.variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
        await setDoc(doc(db, "products", id), {
          ...product,
          stock: stockTotal,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        added++;
      }
    }

    console.log("Import result:", { added, updated });
    return NextResponse.json({
      ok: true,
      addedProducts: added,
      updatedProducts: updated,
    });
  } catch (e: any) {
    console.error("Import CSV error:", e);
    return NextResponse.json({ error: e.message || "Internal server server error" }, { status: 500 });
  }
}