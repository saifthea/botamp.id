import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp, getDocs } from "@/lib/mongo"
import productsData from "@/products.json";

export async function POST() {
  try {
    const snapshot = await getDocs(query(collection(db, "products")));
    if (snapshot.docs.length > 0) {
      return NextResponse.json({
        status: "skipped",
        message: `Produk sudah ada (${snapshot.docs.length} dokumen). Lewati seeding.`,
        count: snapshot.docs.length
      });
    }

    const products = productsData as any[];
    let seeded = 0;

    for (const product of products) {
      // Gunakan setDoc dengan product.id sebagai document ID
      await setDoc(doc(db, "products", product.id), product);
      seeded++;
    }

    return NextResponse.json({
      status: "success",
      message: `Berhasil mengimport ${seeded} produk ke Firestore`,
      count: seeded
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const snapshot = await getDocs(query(collection(db, "products")));
    return NextResponse.json({
      status: "ok",
      count: snapshot.docs.length
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error.message || String(error) },
      { status: 500 }
    );
  }
}