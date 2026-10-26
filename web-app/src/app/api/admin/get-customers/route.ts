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

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.toLowerCase().trim() || "";

  // Ambil semua customer
  const customerSnapshot = await getDocs(query(collection(db, "customers")));
  const customers: any[] = customerSnapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  // Ambil semua pesanan untuk menghitung statistik
  const orderSnapshot = await getDocs(query(collection(db, "pesanan")));
  const orders: any[] = orderSnapshot.docs.map((d) => d.data());

  // Hitung statistik per customer (berdasarkan phone number)
  const statsMap = new Map<string, { totalTransactions: number; totalSpent: number }>();
  for (const order of orders) {
    const phone = (order.customerPhone || "").replace(/\D/g, "");
    if (!phone) continue;
    const stat = statsMap.get(phone) || { totalTransactions: 0, totalSpent: 0 };
    stat.totalTransactions += 1;
    stat.totalSpent += Number(order.total) || 0;
    statsMap.set(phone, stat);
  }

  const enriched = customers.map((c) => {
    const phone = (c.phone || "").replace(/\D/g, "");
    const stat = statsMap.get(phone) || { totalTransactions: 0, totalSpent: 0 };
    return { ...c, totalTransactions: stat.totalTransactions, totalSpent: stat.totalSpent };
  });

  const filtered = search
    ? enriched.filter(
        (c: any) =>
          (c.name || "").toLowerCase().includes(search) ||
          (c.phone || "").includes(search)
      )
    : enriched;

  return NextResponse.json(filtered);
}