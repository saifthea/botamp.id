/**
 * API: POST /api/otp/send
 *
 * Rate limiting: maksimal 3 percobaan per 5 menit per nomor HP
 * Validasi ketat: sanitasi input + deteksi payload XSS
 */
import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"
import { formatPhone, generateOTP, sendWhatsAppMessage } from "@/lib/fonnte";
import { validatePhone, containsXssPayload, sanitizeString } from "@/lib/security";

/** Maksimal percobaan kirim OTP dalam window 5 menit */
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

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Body request tidak valid" },
        { status: 400 }
      );
    }

    const rawPhone = (body as Record<string, unknown>).phone;
    if (rawPhone === undefined || rawPhone === null || rawPhone === "") {
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

    // Validasi Math Captcha (backend-side, mencegah bypass)
    const rawCaptchaA = (body as Record<string, unknown>).captchaA;
    const rawCaptchaB = (body as Record<string, unknown>).captchaB;
    const rawCaptchaAnswer = (body as Record<string, unknown>).captchaAnswer;

    if (rawCaptchaA === undefined || rawCaptchaB === undefined || rawCaptchaAnswer === undefined) {
      return NextResponse.json(
        { error: "Captcha matematika diperlukan" },
        { status: 400 }
      );
    }

    const captchaA = Number(rawCaptchaA);
    const captchaB = Number(rawCaptchaB);
    const captchaAnswer = Number(rawCaptchaAnswer);

    if (!Number.isInteger(captchaA) || !Number.isInteger(captchaB) || !Number.isInteger(captchaAnswer)) {
      return NextResponse.json(
        { error: "Jawaban captcha tidak valid" },
        { status: 400 }
      );
    }

    if (captchaAnswer !== captchaA + captchaB) {
      return NextResponse.json(
        { error: "Jawaban Captcha salah" },
        { status: 400 }
      );
    }

    // Rate limiting per nomor
    const rateKey = `otp-send:${cleanPhone}`;
    const now = Date.now();
    const recent = cleanRateLimitWindow(rateKey, now);
    if (recent.length >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: `Terlalu banyak permintaan. Tunggu ${Math.ceil((RATE_LIMIT_WINDOW_MS / 60_000) - recent.length)} menit lagi.` },
        { status: 429 }
      );
    }
    recent.push(now);
    rateLimitStore.set(rateKey, recent);

    const rawName = (body as Record<string, unknown>).name;
    const displayName = rawName
      ? String(rawName).slice(0, 60)
      : "";
    // Sanitasi nama: hapus kontrol karakter
    const sanitizedName = sanitizeString(displayName, 60);

    // Generate OTP (6 digits)
    const otp = generateOTP(6);

    // Simpan OTP di Firestore dengan expiry 5 menit
    const otpRef = doc(db, "otps", cleanPhone);
    await setDoc(otpRef, {
      otp,
      phone: cleanPhone,
      name: sanitizedName,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      attempts: 0,
    });

    // Kirim WhatsApp via Fonnte
    const message = `Kode OTP Anda: ${otp}\n\nKode ini berlaku selama 5 menit. Jangan berikan kepada siapa pun.`;
    const result = await sendWhatsAppMessage({
      target: formatPhone(cleanPhone),
      message,
    });

    if (!result.status) {
      return NextResponse.json(
        { error: "Gagal mengirim OTP: " + (result.message || "Unknown error") },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "OTP telah dikirim ke WhatsApp",
      phone: cleanPhone,
    });
  } catch (e: any) {
    console.error("[otp/send] Error:", e?.message, e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}