/**
 * API: POST /api/auth/check-phone
 *
 * Rate limiting: maksimal 5 percobaan per 1 menit per nomor HP.
 * Menggunakan Map in-memory sebagai store sederhana. Untuk produksi
 * dengan skala besar, ganti dengan Redis atau store eksternal.
 */
import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"
import { validatePhone, containsXssPayload, sanitizeString } from "@/lib/security";

/**
 * Maksimal percobaan dalam window waktu tertentu.
 */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 menit

/** Store rate limit: phone -> array of timestamps */
const rateLimitStore = new Map<string, number[]>();

function tryGetRateLimitKey(req: Request): string | null {
  // Prioritaskan header X-Forwarded-For (load balancer/CDN)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  // Untuk localhost & inline deployment gunakan 127.0.0.1
  return "127.0.0.1";
}

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
      return NextResponse.json({ error: "Nomor diperlukan" }, { status: 400 });
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

    // --- Rate limiting per nomor telepon (brute-force prevention) ---
    const rateKey = `phone:${cleanPhone}`;
    const now = Date.now();
    const recent = cleanRateLimitWindow(rateKey, now);
    if (recent.length >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: `Terlalu banyak percobaan. Tunggu beberapa menit lagi.` },
        { status: 429 }
      );
    }
    recent.push(now);
    rateLimitStore.set(rateKey, recent);

    // Opsional: rate limit per IP juga (untuk mencegah serangan koordinatif)
    const ipKey = tryGetRateLimitKey(req);
    if (ipKey) {
      const ipList = cleanRateLimitWindow(ipKey, now);
      if (ipList.length >= RATE_LIMIT_MAX * 10) {
        // 10x lebih longgar untuk IP (karena bisa shared IP)
        return NextResponse.json(
          { error: "Terlalu banyak percobaan dari IP ini. Tunggu beberapa menit lagi." },
          { status: 429 }
        );
      }
      ipList.push(now);
      rateLimitStore.set(ipKey, ipList);
    }

    const docRef = doc(db, "customers", cleanPhone);
    const snap = await getDoc(docRef);

    return NextResponse.json({ exists: snap.exists() });
  } catch (e: any) {
    console.error("[check-phone] Error:", e?.message, e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}