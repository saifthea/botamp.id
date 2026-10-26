/**
 * API: POST /api/customer/update
 * Mengupdate data customer
 */
import { NextResponse } from "next/server";
import { updateCustomerData } from "@/lib/customers";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, data } = body as { phone?: string; data?: Record<string, any> };

    if (!phone || !data) {
      return NextResponse.json(
        { error: "Nomor HP dan data diperlukan" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "");
    await updateCustomerData(cleanPhone, data);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[customer/update] Error:", e?.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
