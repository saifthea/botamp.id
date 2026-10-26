/**
 * API: POST /api/customer/reset-password
 *
 * Verifikasi OTP reset password, lalu update passwordHash customer di Firestore.
 * Hanya password yang berubah — data pesanan & histori tidak tersentuh.
 */
import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"
import { validatePhone, containsXssPayload } from "@/lib/security";

/** Hash password PBKDF2 (SHA-256, 100k iterasi) — format sama dengan AuthContext */
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );

  const hashArray = new Uint8Array(hashBuffer);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);
  return btoa(String.fromCharCode(...combined));
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

    const { phone, otp, newPassword } = body as Record<string, unknown>;
    if (!phone || !otp || !newPassword) {
      return NextResponse.json(
        { error: "Nomor WhatsApp, OTP, dan password baru diperlukan" },
        { status: 400 }
      );
    }

    const phoneStr = String(phone).replace(/\s/g, "");
    if (containsXssPayload(phoneStr) || containsXssPayload(String(newPassword))) {
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

    // Validasi password baru: minimal 6, maksimal 72 karakter
    const pwdStr = String(newPassword).slice(0, 72);
    if (pwdStr.length < 6) {
      return NextResponse.json(
        { error: "Password baru minimal 6 karakter" },
        { status: 400 }
      );
    }

    // Ambil OTP
    const otpRef = doc(db, "otps", `reset-${cleanPhone}`);
    const otpSnap = await getDoc(otpRef);

    if (!otpSnap.exists() || !otpSnap.data().otp) {
      return NextResponse.json(
        { error: "OTP tidak ditemukan. Silakan minta ulang." },
        { status: 400 }
      );
    }

    const otpData = otpSnap.data();

    // Cek expiry
    if (Date.now() > new Date(otpData.expiresAt).getTime()) {
      return NextResponse.json(
        { error: "OTP sudah kadaluarsa. Silakan minta ulang." },
        { status: 400 }
      );
    }

    // Cek jumlah percobaan
    if ((otpData.attempts || 0) >= 5) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Silakan minta OTP baru." },
        { status: 429 }
      );
    }

    if (otpData.otp !== String(otp).trim()) {
      await updateDoc(otpRef, {
        attempts: (otpData.attempts || 0) + 1,
      });
      return NextResponse.json({ error: "OTP salah" }, { status: 400 });
    }

    // Update passwordHash di Firestore (data lain tidak diubah)
    const custRef = doc(db, "customers", cleanPhone);
    const custSnap = await getDoc(custRef);
    if (!custSnap.exists()) {
      return NextResponse.json(
        { error: "Customer tidak ditemukan" },
        { status: 404 }
      );
    }

    const passwordHash = await hashPassword(pwdStr);
    await updateDoc(custRef, {
      passwordHash,
      passwordUpdatedAt: new Date().toISOString(),
    });

    // Inaktifkan OTP setelah sukses
    await updateDoc(otpRef, { otp: "", attempts: 5 });

    return NextResponse.json({
      ok: true,
      message: "Password berhasil diperbarui. Silakan login dengan password baru.",
    });
  } catch (e: any) {
    console.error("[customer/reset-password] Error:", e?.message, e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}