import { NextResponse } from "next/server";
import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"
import { isValidToken } from "@/app/api/admin/session/route";

async function verify(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("AdminSession ")) return false;
  const token = auth.replace("AdminSession ", "");
  return await isValidToken(token);
}

export async function GET(req: Request) {
  if (!await verify(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const q = query(collection(db, "komplain"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => {
      const d = doc.data();
      const createdAt = d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null;
      return { id: doc.id, ...d, createdAt };
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("Gagal ambil komplain:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}