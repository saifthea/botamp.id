// Utilitas keamanan: sanitasi input, validasi ketat, dan deteksi payload XSS.

/** Karakter yang diizinkan untuk nama: huruf (termasuk aksen), spasi, dan tanda hubung (misal "Mary-Jane") */
const NAME_PATTERN = /^[a-zA-ZÀ-ÿ'\- ]{2,60}$/;

/** Nomor WhatsApp Indonesia: diawali 08 (lokal) atau +62 (internasional), total 10-15 digit */
const PHONE_LOCAL_PATTERN = /^08\d{8,12}$/;
const PHONE_INTL_PATTERN = /^\+62\d{8,12}$/;

/** Pola payload XSS / script injection yang harus ditolak */
const XSS_PATTERNS: RegExp[] = [
  /<\s*script/i,
  /<\s*iframe/i,
  /<\s*object/i,
  /<\s*embed/i,
  /<\s*form/i,
  /<\s*img/i,
  /<\s*svg/i,
  /<\s*body/i,
  /<\s*link/i,
  /<\s*meta/i,
  /<\s*input/i,
  /<\s*button/i,
  /<\s*div/i,
  /on\w+\s*=/i, // onerror=, onload=, onclick=, dll
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /expression\s*\(/i,
  /document\s*\.\s*(cookie|location|write)/i,
  /window\s*\.\s*location/i,
  /\beval\s*\(/i,
  /<\s*!doctype/i,
  /%3Cscript/i, // encoded <script
  /%3Ciframe/i,
];

export interface ValidationResult {
  ok: boolean;
  error?: string;
  /** Nilai yang sudah dibersihkan (jika ok) */
  value?: string;
}

/**
 * Cek apakah string mengandung payload XSS/script injection.
 */
export function containsXssPayload(input: string): boolean {
  if (typeof input !== "string") return true;
  return XSS_PATTERNS.some((re) => re.test(input));
}

/**
 * Sanitasi string: trim, hapus kontrol karakter, batasi panjang.
 * @returns nilai bersih
 */
export function sanitizeString(input: unknown, maxLength = 200): string {
  if (typeof input !== "string") return "";
  // Hapus kontrol karakter (0x00-0x1F, 0x7F)
  return input.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, maxLength);
}

/**
 * Validasi Nama Lengkap:
 * - Tolak payload XSS
 * - Hanya boleh huruf, spasi, apostrof, tanda hubung
 * - Panjang 2-60 karakter
 */
export function validateName(input: unknown): ValidationResult {
  const raw = sanitizeString(input, 60);
  if (containsXssPayload(raw)) {
    return { ok: false, error: "Karakter tidak valid terdeteksi" };
  }
  if (!NAME_PATTERN.test(raw)) {
    return { ok: false, error: "Nama hanya boleh berisi huruf, spasi, dan tanda hubung (2-60 karakter)" };
  }
  return { ok: true, value: raw };
}

/**
 * Normalisasi nomor WhatsApp ke format tanpa + (62xxx / 08xxx).
 */
export function normalizePhone(input: string): string {
  let p = input.trim();
  if (p.startsWith("+62")) p = "62" + p.slice(3);
  else if (p.startsWith("0062")) p = "62" + p.slice(4);
  else if (p.startsWith("62") && p.length > 10) p = p; // sudah 62
  return p;
}

/**
 * Validasi No. WhatsApp:
 * - Hanya digit (opsional awalan +)
 * - Format: 08xxxxxxxxxx atau +62xxxxxxxxxx
 * - Panjang 10-15 digit
 */
export function validatePhone(input: unknown): ValidationResult {
  const raw = sanitizeString(input, 20);
  if (containsXssPayload(raw)) {
    return { ok: false, error: "Karakter tidak valid terdeteksi" };
  }
  if (PHONE_LOCAL_PATTERN.test(raw)) {
    return { ok: true, value: raw };
  }
  if (PHONE_INTL_PATTERN.test(raw)) {
    return { ok: true, value: raw.replace("+", "") };
  }
  return { ok: false, error: "Nomor WhatsApp tidak valid (format: 08xxxxxxxxxx)" };
}

/**
 * Validasi Password (client-side):
 * - Minimal 6 karakter, maksimal 72 karakter (batas praktik baik PBKDF2/SHA-256)
 * - Tidak boleh mengandung payload XSS / kontrol karakter
 */
export function validatePassword(input: unknown): ValidationResult {
  if (typeof input !== "string") {
    return { ok: false, error: "Password tidak valid" };
  }
  const raw = input.replace(/[\x00-\x1F\x7F]/g, "");
  if (containsXssPayload(raw)) {
    return { ok: false, error: "Karakter tidak valid terdeteksi" };
  }
  if (raw.length < 6) {
    return { ok: false, error: "Password minimal 6 karakter" };
  }
  if (raw.length > 72) {
    return { ok: false, error: "Password maksimal 72 karakter" };
  }
  return { ok: true, value: raw };
}

/**
 * Validasi OTP: tepat 6 digit angka.
 */
export function validateOtp(input: unknown): ValidationResult {
  const raw = sanitizeString(input, 6);
  if (!/^\d{6}$/.test(raw)) {
    return { ok: false, error: "OTP harus berupa 6 digit angka" };
  }
  return { ok: true, value: raw };
}
