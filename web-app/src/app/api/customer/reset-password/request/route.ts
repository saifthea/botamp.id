/**
 * API: POST /api/customer/reset-password/request
 *
 * Kirim OTP reset password ke WhatsApp customer terdaftar.
 * OTP disimpan di Firestore dengan expiry 5 menit.
 * Rate limiting: 3x per 5 menit per nomor HP.
 */
import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"
import { formatPhone, generateOTP, sendWhatsAppMessage } from "@/lib/fonnte";
import { validatePhone, containsXssPayload } from "@/lib/security";

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

const rateLimitStore = new Map<string, number[]>();

function cleanRateLimitWindow(key: string, now: number) {
  const list = rateLimitStore.get(key) ?? [];
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const clean = list.filter((t) => t > cutoff);
  if (clean.length === 0) {
    rateLimitStore.delete(key);
  } else {
    rateLimitStore.set(key, clean);
  }
  return clean;
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Format JSON tidak valid" },
        { status: 400 }
      );
    }

    const rawPhone = (body as Record<string, unknown>).phone;
    if (!rawPhone) {
      return NextResponse.json(
        { error: "Nomor WhatsApp diperlukan" },
        { status: 400 }
      );
    }

    const phoneStr = String(rawPhone).replace(/\s/g, "");
    if (containsXssPayload(phoneStr)) {
      return NextResponse.json(
        { error: "Karakter tidak valid terdeteksi" },
        { status: 400 }
      );
    }

    const phoneRes = validatePhone(phoneStr);
    if (!phoneRes.ok) {
      return NextResponse.json({ error: phoneRes.error }, { status: 400 });
    }
    const cleanPhone = phoneRes.value!;

    // Cek apakah customer terdaftar
    const custSnap = await getDoc(doc(db, "customers", cleanPhone));
    if (!custSnap.exists()) {
      return NextResponse.json(
        { error: "Nomor WhatsApp tidak terdaftar" },
        { status: 404 }
      );
    }

    // Rate limiting per nomor
    const rateKey = `reset-otp:${cleanPhone}`;
    const now = Date.now();
    const recent = cleanRateLimitWindow(rateKey, now);
    if (recent.length >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Coba lagi 5 menit kemudian." },
        { status: 429 }
      );
    }
    recent.push(now);
    rateLimitStore.set(rateKey, recent);

    // Generate & simpan OTP (doc terpisah agar tidak bentrok dengan OTP login)
    const otp = generateOTP(6);
    await setDoc(doc(db, "otps", `reset-${cleanPhone}`), {
      otp,
      phone: cleanPhone,
      purpose: "reset-password",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(now + 5 * 60 * 1000).toISOString(),
      attempts: 0,
    });

    // Kirim WhatsApp via Fonnte
    const result = await sendWhatsAppMessage({
      target: formatPhone(cleanPhone),
      message: `Kode reset password Anda: ${otp}\n\nKode ini berlaku 5 menit. Jangan berikan ke siapa pun.`,
    });

    if (!result.status) {
      return NextResponse.json(
        { error: "Gagal mengirim OTP: " + (result.message || "Unknown error") },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "OTP telah dikirim ke WhatsApp Anda",
    });
  } catch (e: any) {
    console.error("[reset-password/request] Error:", e?.message, e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}