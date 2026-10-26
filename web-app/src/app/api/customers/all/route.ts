/**
 * API: GET /api/customers/all
 * Mengambil semua customer dari MongoDB
 */
import { NextResponse } from "next/server";
import { db, collection, getDocs, query } from "@/lib/mongo";

export async function GET() {
  try {
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

    return NextResponse.json({ customers: enriched });
  } catch (e: any) {
    console.error("[customers/all] Error:", e?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}