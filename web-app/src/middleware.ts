/**
 * Middleware: menambahkan security headers ke semua response.
 * Melindungi dari serangan XSS, clickjacking, MIME sniffing, dll.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const isDev = process.env.NODE_ENV === "development";

  // === Content Security Policy (CSP) ===
  // Domain whitelist: hanya domain yang dibutuhkan aplikasi (Midtrans, Fonnte)
  const cspHeader = isDev
    ? [
        "default-src 'self' https: data:;",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.midtrans.com https://app.sandbox.midtrans.com;",
        "style-src 'self' 'unsafe-inline';",
        "img-src 'self' data: https:;",
        "font-src 'self';",
        "connect-src 'self' https: data:;",
        "frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com;",
        "object-src 'none';",
        "base-uri 'self';",
        "form-action 'self';",
        "frame-ancestors 'none';",
        "upgrade-insecure-requests;",
      ].join(" ")
    : [
        "default-src 'self';",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.midtrans.com https://app.sandbox.midtrans.com;",
        "style-src 'self' 'unsafe-inline';",
        "img-src 'self' data: https:;",
        "font-src 'self';",
        "connect-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com https://api.fonnte.com;",
        "frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com;",
        "object-src 'none';",
        "base-uri 'self';",
        "form-action 'self';",
        "frame-ancestors 'none';",
        "upgrade-insecure-requests;",
      ].join(" ");
  res.headers.set("Content-Security-Policy", cspHeader);

  // === X-Frame-Options: mencegah clickjacking ===
  res.headers.set("X-Frame-Options", "DENY");

  // === X-Content-Type-Options: mencegah MIME sniffing ===
  res.headers.set("X-Content-Type-Options", "nosniff");

  // === X-XSS-Protection: proteksi XSS lama (legacy) ===
  res.headers.set("X-XSS-Protection", "1; mode=block");

  // === Referrer-Policy: kontrol referrer info ===
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // === Permissions-Policy: batasi fitur browser ===
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // === Strict-Transport-Security: force HTTPS (production only) ===
  // Catatan: tidak aktifkan di localhost dev
  if (!isDev) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return res;
}

/**
 * Jalankan middleware untuk semua route kecuali static files dan API internals
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
