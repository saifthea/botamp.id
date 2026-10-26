// Fonnte WhatsApp API utility
// Documentation: https://docs.fonnte.com/

const FONNTE_BASE_URL = "https://api.fonnte.com";

export interface FonnteMessage {
  target: string; // phone number with country code, e.g., 6281234567890
  message: string;
  // Optional parameters
  delay?: number;
  retry?: number;
  schedule?: string; // ISO date string for scheduled sending
  // For media
  file?: string; // URL or base64
  caption?: string;
}

export interface FonnteResponse {
  status: boolean;
  message?: string;
  id?: string;
}

/**
 * Send WhatsApp message via Fonnte API
 * @param message - Message configuration
 * @returns FonnteResponse
 */
export async function sendWhatsAppMessage(
  message: FonnteMessage
): Promise<FonnteResponse> {
  const apiKey = process.env.FONNTE_API_KEY;
  console.log("[Fonnte] Dynamic API key:", apiKey ? `YES (${apiKey.slice(0, 8)}...)` : "MISSING");

  if (!apiKey) {
    console.error("FONNTE_API_KEY not configured");
    return { status: false, message: "FONNTE_API_KEY not configured" };
  }

  try {
    const payload = {
      ...message,
      // Pastikan target dalam format internasional (tanpa leading 0)
      target: message.target,
      // Fonnte default countryCode 62; kita set eksplisit agar nomor 08xxx diganti jadi 628xxx
      countryCode: "62",
    };
    console.log("[Fonnte] Sending:", { target: payload.target, countryCode: payload.countryCode, messageLen: payload.message.length });

    const res = await fetch(`${FONNTE_BASE_URL}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("[Fonnte] Response:", JSON.stringify(data));
    // Fonnte response tidak konsisten: success pakai "status" (kecil), error pakai "Status" (besar)
    const ok = data.status === true || data.Status === true;
    return {
      status: ok,
      message: data.message || data.reason || data.detail || (res.ok ? "Sent" : "Failed"),
      id: data.id,
    };
  } catch (e: any) {
    console.error("Fonnte send error:", e);
    return { status: false, message: e?.message || "Network error" };
  }
}

/**
 * Format phone number to international format (e.g., 6281234567890)
 * @param phone - Phone number in any format
 * @returns Formatted phone number
 */
export function formatPhone(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // Handle Indonesian numbers
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned;
  } else if (!cleaned.startsWith("62")) {
    cleaned = "62" + cleaned;
  }

  return cleaned;
}

/**
 * Generate random OTP code (4-6 digits)
 * @param length - Length of OTP (default 6)
 * @returns OTP code as string
 */
export function generateOTP(length: number = 6): string {
  const digits = "0123456789";
  let otp = "";
  const cryptoObj = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    otp += digits[cryptoObj[i] % 10];
  }
  return otp;
}