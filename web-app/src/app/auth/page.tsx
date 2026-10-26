"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import {
  containsXssPayload,
  validateName,
  validatePhone,
  validatePassword,
  validateOtp,
} from "@/lib/security";
import { generateMathCaptcha, MathCaptcha } from "@/lib/captcha";

function AuthPageContent() {
  const { loginOrRegister } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captcha, setCaptcha] = useState<MathCaptcha | null>(null);
  const [step, setStep] = useState<"input" | "otp">("input");
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Generate captcha hanya di client-side untuk hindari hydration mismatch
  useEffect(() => {
    setCaptcha(generateMathCaptcha());
  }, []);

  // Generate soal captcha baru setiap kali mount atau refresh
  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateMathCaptcha());
    setCaptchaAnswer("");
  }, []);

  // Sanitasi saat mengetik: tolak instan jika terdeteksi payload XSS
  const handleNameChange = (v: string) => {
    if (containsXssPayload(v)) {
      setError("Karakter tidak valid terdeteksi");
      return;
    }
    setName(v.slice(0, 60));
  };

  const handlePhoneChange = (v: string) => {
    if (containsXssPayload(v)) {
      setError("Karakter tidak valid terdeteksi");
      return;
    }
    setPhone(v.slice(0, 20));
  };

  const handlePasswordChange = (v: string) => {
    if (containsXssPayload(v)) {
      setError("Karakter tidak valid terdeteksi");
      return;
    }
    setPassword(v.slice(0, 72));
  };

  const handleOtpChange = (v: string) => {
    // OTP hanya boleh digit
    setOtp(v.replace(/\D/g, "").slice(0, 6));
  };

  const handleCaptchaChange = (v: string) => {
    // Hanya angka
    setCaptchaAnswer(v.replace(/\D/g, "").slice(0, 2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validasi ketat format data sebelum dikirim ke API/Firestore
      const nameRes = validateName(name);
      if (!nameRes.ok) throw new Error(nameRes.error);
      const phoneRes = validatePhone(phone);
      if (!phoneRes.ok) throw new Error(phoneRes.error);
      const pwdRes = validatePassword(password);
      if (!pwdRes.ok) throw new Error(pwdRes.error);

      const cleanName = nameRes.value!;
      const cleanPhone = phoneRes.value!;
      const cleanPassword = pwdRes.value!;

      if (step === "input") {
        // Cek apakah nomor sudah terdaftar
        const checkRes = await fetch("/api/auth/check-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: cleanPhone }),
        });
        const checkData = await checkRes.json();

        if (checkData.exists) {
          // User sudah terdaftar → skip OTP, login langsung
          await loginOrRegister(cleanPhone, cleanName, cleanPassword);
          const redirect = searchParams.get("redirect") || "/";
          router.push(redirect);
          router.refresh();
          return;
        }

        // User baru → validasi Math Captcha sebelum kirim OTP
        if (!captcha) throw new Error("Captcha belum dimuat, coba lagi");
        const captchaNum = parseInt(captchaAnswer, 10);
        if (isNaN(captchaNum) || captchaNum !== captcha.answer) {
          throw new Error("Jawaban Captcha salah");
        }

        // Kirim OTP ke backend (backend juga validasi captcha untuk mencegah bypass)
        const res = await fetch("/api/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: cleanPhone,
            name: cleanName,
            captchaAnswer: captchaNum,
            captchaA: captcha.a,
            captchaB: captcha.b,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal mengirim OTP");

        setStep("otp");
        refreshCaptcha(); // Buat soal baru setelah OTP terkirim
      } else {
        if (isExistingUser) {
          // User sudah terdaftar → langsung login tanpa verifikasi OTP
          await loginOrRegister(cleanPhone, cleanName, cleanPassword);
        } else {
          // User baru → verifikasi OTP dulu
          const otpRes = validateOtp(otp);
          if (!otpRes.ok) throw new Error(otpRes.error);

          const res = await fetch("/api/otp/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: cleanPhone, otp: otpRes.value }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "OTP tidak valid");

          await loginOrRegister(cleanPhone, cleanName, cleanPassword);
        }

        const redirect = searchParams.get("redirect") || "/";
        router.push(redirect);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto space-y-6 mt-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-green-800 dark:text-green-200">Masuk / Daftar</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {step === "input"
            ? "Masukkan nama, nomor WhatsApp, dan password"
            : isExistingUser
            ? "Nomor sudah terdaftar. Langsung masuk!"
            : `Masukkan kode OTP yang dikirim ke ${phone}`}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 space-y-4">
        {step === "input" ? (
          <>
            <div>
              <label className="text-xs font-semibold text-zinc-500">Nama Lengkap</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Nama lengkap"
                maxLength={60}
                className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-500">No. WhatsApp</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="08xxxxxxxxxx"
                maxLength={20}
                className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-500">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Minimal 6 karakter"
                maxLength={72}
                className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
                required
              />
            </div>
          </>
        ) : (
          !isExistingUser && (
            <div>
              <label className="text-xs font-semibold text-zinc-500">Kode OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => handleOtpChange(e.target.value)}
                placeholder="Masukkan 6 digit OTP"
                maxLength={6}
                className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none text-center text-xl tracking-widest"
                required
              />
            </div>
          )
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">{error}</p>
        )}

        {step === "input" && (
          <div className="pt-2 border-t border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-2">
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  {captcha ? `Berapa ${captcha.a} + ${captcha.b}?` : "Memuat soal..."}
                </span>
              </div>
              <input
                type="text"
                value={captchaAnswer}
                onChange={(e) => handleCaptchaChange(e.target.value)}
                placeholder="Jawaban"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                disabled={!captcha}
                className="w-20 p-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none text-center disabled:opacity-50"
              />
              <button
                type="button"
                onClick={refreshCaptcha}
                className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 text-sm"
                title="Generate soal baru"
              >
                🔄
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              Selesaikan soal matematika di atas untuk melanjutkan verifikasi OTP.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {loading ? "Memproses..." : step === "input" ? "Login" : "Masuk"}
        </button>

        {step === "input" && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                if (!phone) {
                  setError("Masukkan nomor WhatsApp terlebih dahulu");
                  return;
                }
                router.push(`/reset-password?phone=${encodeURIComponent(phone)}`);
              }}
              className="text-sm text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 font-medium"
            >
              Lupa password?
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><p className="text-zinc-500">Memuat...</p></div>}>
      <AuthPageContent />
    </Suspense>
  );
}
