import { NextResponse } from "next/server";
import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"
import { isValidToken } from "@/app/api/admin/session/route";

async function verify(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("AdminSession ")) return false;
  const token = auth.replace("AdminSession ", "");
  return await isValidToken(token);
}

export async function POST(req: Request) {
  if (!await verify(req)) {
    console.log("[update-komplain-note] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, adminNote, newStatus } = body;
  console.log("[update-komplain-note] Received:", { id, adminNote, newStatus });

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const komplainRef = doc(db, "komplain", id);
    const komplainSnap = await getDoc(komplainRef);

    if (!komplainSnap.exists()) {
      console.log("[update-komplain-note] Komplain document not found:", id);
      return NextResponse.json({ error: "Komplain tidak ditemukan" }, { status: 404 });
    }

    const komplainData = komplainSnap.data();
    const orderId = komplainData.orderId;
    console.log("[update-komplain-note] Found komplain:", { id, orderId, currentStatus: komplainData.status });

    const updateData: Record<string, any> = {};

    // Hanya update adminNote jika value-nya diberikan (bukan undefined)
    if (adminNote !== undefined) {
      updateData.adminNote = adminNote;
    }

    // Jika status diubah menjadi "selesai", update juga status komplain dan pesanan
    if (newStatus === "selesai") {
      updateData.status = "selesai";

      // Update pesanan: tetapkan komplainSelesai=true dan hapus hasComplaint
      // JANGAN ubah status pesanan agar tetap di tab "Telah Diproses"
      if (orderId) {
        try {
          const pesananQ = query(
            collection(db, "pesanan"),
            where("orderId", "==", orderId)
          );
          const pesananSnap = await getDocs(pesananQ);
          console.log("[update-komplain-note] Found pesanan docs:", pesananSnap.docs.length, "for orderId:", orderId);
          for (const p of pesananSnap.docs) {
            await updateDoc(doc(db, "pesanan", p.id), {
              komplainSelesai: true,
              hasComplaint: false,
            });
            console.log("[update-komplain-note] Updated pesanan doc:", p.id, "orderId:", orderId);
          }
        } catch (e) {
          console.error("[update-komplain-note] Gagal update flag pesanan:", e);
        }
      } else {
        console.warn("[update-komplain-note] No orderId found in komplain document:", id);
      }
    }

    if (Object.keys(updateData).length > 0) {
      await updateDoc(komplainRef, updateData);
      console.log("[update-komplain-note] Updated komplain doc:", id, "to:", updateData);
    } else {
      console.log("[update-komplain-note] No fields to update for komplain:", id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[update-komplain-note] Error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}