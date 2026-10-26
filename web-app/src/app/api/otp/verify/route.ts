/**
 * API: POST /api/otp/verify
 *
 * Rate limiting: maksimal 10 percobaan per 5 menit per nomor HP
 * Input sanitasi ketat untuk mencegah abuse
 */
import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"
import { validateOtp, validatePhone, containsXssPayload } from "@/lib/security";

/** Maksimal percobaan verifikasi per 5 menit */
const RATE_LIMIT_MAX = 10;
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

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Body request tidak valid" },
        { status: 400 }
      );
    }

    const rawPhone = (body as Record<string, unknown>).phone;
    const rawOtp = (body as Record<string, unknown>).otp;

    if (rawPhone === undefined || rawPhone === null || rawPhone === "") {
      return NextResponse.json(
        { error: "Nomor WhatsApp diperlukan" },
        { status: 400 }
      );
    }

    if (rawOtp === undefined || rawOtp === null || rawOtp === "") {
      return NextResponse.json(
        { error: "Kode OTP diperlukan" },
        { status: 400 }
      );
    }

    const phoneStr = String(rawPhone).replace(/\s/g, "");
    const otpStr = String(rawOtp).replace(/\s/g, "");

    if (containsXssPayload(phoneStr) || containsXssPayload(otpStr)) {
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

    const otpRes = validateOtp(otpStr);
    if (!otpRes.ok) {
      return NextResponse.json({ error: otpRes.error }, { status: 400 });
    }
    const cleanOtp = otpRes.value!;

    // Rate limiting per nomor
    const rateKey = `otp-verify:${cleanPhone}`;
    const now = Date.now();
    const recent = cleanRateLimitWindow(rateKey, now);
    if (recent.length >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Tunggu beberapa menit lagi." },
        { status: 429 }
      );
    }
    recent.push(now);
    rateLimitStore.set(rateKey, recent);

    // Ambil OTP dari Firestore
    const otpRef = doc(db, "otps", cleanPhone);
    const snap = await getDoc(otpRef);

    if (!snap.exists()) {
      return NextResponse.json(
        { error: "OTP tidak ditemukan. Silakan kirim ulang." },
        { status: 404 }
      );
    }

    const data = snap.data() as any;

    // Cek expired
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "OTP sudah kadaluarsa. Silakan kirim ulang." },
        { status: 410 }
      );
    }

    // Cek attempts (max 3)
    const attempts = data.attempts || 0;
    if (attempts >= 3) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Silakan kirim ulang OTP." },
        { status: 429 }
      );
    }

    // Verifikasi OTP
    if (data.otp !== cleanOtp) {
      // Increment attempts
      await updateDoc(otpRef, { attempts: attempts + 1 });
      return NextResponse.json(
        { error: "OTP tidak valid" },
        { status: 400 }
      );
    }

    // Sukses - hapus OTP
    await updateDoc(otpRef, { verified: true, verifiedAt: new Date().toISOString() });

    return NextResponse.json({
      ok: true,
      message: "OTP valid",
      phone: cleanPhone,
      name: data.name || "",
    });
  } catch (e: any) {
    console.error("[otp/verify] Error:", e?.message, e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}