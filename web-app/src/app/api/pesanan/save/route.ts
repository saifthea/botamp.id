/**
 * API: POST /api/pesanan/save
 * Menyimpan pesanan baru ke MongoDB
 */
import { NextResponse } from "next/server";
import { db, collection, addDoc, Timestamp } from "@/lib/mongo";

interface PesananData {
  orderId: string;
  customerId?: string;
  customerPhone?: string;
  customerName: string;
  address: string;
  city: string;
  postal_code?: string;
  items: any[];
  subtotal: number;
  shippingCost: number;
  courier?: string;
  service?: string;
  service_type?: "instant" | "reguler";
  paymentStatus?: string;
  total: number;
}

export async function POST(req: Request) {
  try {
    const data = await req.json() as PesananData;

    const docRef = await addDoc(collection(db, "pesanan"), {
      ...data,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({
      id: docRef.id,
      ...data,
    });
  } catch (e: any) {
    console.error("[pesanan/save] Error:", e?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}