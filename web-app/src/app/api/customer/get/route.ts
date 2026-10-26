/**
 * API: POST /api/customer/get
 * Mendapatkan data customer berdasarkan nomor HP
 */
import { NextResponse } from "next/server";
import { getCustomerByPhone } from "@/lib/customers";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone } = body as { phone?: string };

    if (!phone) {
      return NextResponse.json(
        { error: "Nomor HP diperlukan" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const customer = await getCustomerByPhone(cleanPhone);

    if (!customer) {
      return NextResponse.json(
        { error: "Customer tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ customer });
  } catch (e: any) {
    console.error("[customer/get] Error:", e?.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
