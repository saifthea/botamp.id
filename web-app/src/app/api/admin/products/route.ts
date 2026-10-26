import { NextResponse } from "next/server";
import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"
import { isValidToken } from "@/app/api/admin/session/route";

async function verify(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("AdminSession ")) return false;
  const token = auth.replace("AdminSession ", "");
  return await isValidToken(token);
}

// GET - ambil semua products
export async function GET(req: Request) {
  if (!await verify(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await getDocs(query(collection(db, "products")));
    const data = snapshot.docs.map((doc) => {
      const d = doc.data();
      return { ...d, id: d.id || doc.id };
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("Gagal ambil products:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - tambah atau update product
export async function POST(req: Request) {
  if (!await verify(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, name, sku, description, category, price, stock, images, variants } = body;

  if (!id || !sku?.trim()) {
    return NextResponse.json({ error: "ID dan SKU wajib diisi" }, { status: 400 });
  }

  try {
    const productData: any = {
      name: name || "",
      sku: sku.trim(),
      description: description || "",
      category: category || "",
      price: price ?? 0,
      stock: stock ?? 0,
      images: Array.isArray(images) ? images : [],
      variants: Array.isArray(variants) ? variants : [],
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, "products", id), productData, { merge: true });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("Gagal simpan product:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - hapus product
export async function DELETE(req: Request) {
  if (!await verify(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await deleteDoc(doc(db, "products", id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Gagal hapus product:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}