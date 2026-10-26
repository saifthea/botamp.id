import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp, getDocs } from "@/lib/mongo";
import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://adminstore:passwordkuat123@31.97.223.157:27017/webstoreku?authSource=admin";

// Migrasi field id menjadi id_products pada dokumen products (tanpa mengubah document ID)
export async function POST() {
  try {
    const snapshot = await getDocs(query(collection(db, "products")));
    let migrated = 0;
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const col = client.db("webstoreku").collection("products");

    for (const snap of snapshot.docs) {
      const data = snap.data() as any;
      // Jika field id ada di level dokumen (bukan di dalam variants)
      if (data.id !== undefined) {
        // Salin nilai id ke field id_products, lalu hapus field id
        await col.updateOne({ _id: new ObjectId(snap.id) }, {
          $set: { id_products: data.id },
          $unset: { id: "" },
        });
        migrated++;
      }
    }

    await client.close();

    return NextResponse.json({
      status: "ok",
      migrated,
      total: snapshot.docs.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { status: "error", message: e.message || String(e) },
      { status: 500 }
    );
  }
}