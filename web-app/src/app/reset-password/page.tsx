"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { containsXssPayload } from "@/lib/security";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPhone = searchParams.get("phone") || "";

  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"otp" | "password">("otp");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Tampilkan nomor dari query params
  useEffect(() => {
    if (initialPhone) setPhone(initialPhone);
  }, [initialPhone]);

  const handlePhoneChange = (v: string) => {
    if (containsXssPayload(v)) {
      setError("Karakter tidak valid terdeteksi");
      return;
    }
    setPhone(v.replace(/\D/g, "").slice(0, 20));
    setError("");
  };

  const handleOtpChange = (v: string) => {
    setOtp(v.replace(/\D/g, "").slice(0, 6));
    setError("");
  };

  const handlePasswordChange = (v: string) => {
    if (containsXssPayload(v)) {
      setError("Karakter tidak valid terdeteksi");
      return;
    }
    setNewPassword(v.slice(0, 72));
    setError("");
  };

  const handleConfirmChange = (v: string) => {
    if (containsXssPayload(v)) {
      setError("Karakter tidak valid terdeteksi");
      return;
    }
    setConfirmPassword(v.slice(0, 72));
    setError("");
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (phone.length < 9) throw new Error("Nomor WhatsApp tidak valid");

      const res = await fetch("/api/customer/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim OTP");

      setStep("password");
      setError("");
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (newPassword.length < 6) throw new Error("Password baru minimal 6 karakter");
      if (newPassword !== confirmPassword) throw new Error("Konfirmasi password tidak cocok");

      const res = await fetch("/api/customer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal reset password");

      setSuccess(data.message || "Password berhasil diperbarui.");
      // Redirect ke halaman login setelah 3 detik
      setTimeout(() => router.push("/auth"), 3000);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto space-y-6 mt-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-green-800 dark:text-green-200">Reset Password</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {step === "otp"
            ? "Masukkan nomor WhatsApp terdaftar untuk menerima OTP"
            : `Masukkan OTP dan password baru untuk ${phone}`}
        </p>
      </div>

      {success ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 text-center space-y-4">
          <p className="text-3xl">✅</p>
          <p className="text-green-700 dark:text-green-300 font-medium">{success}</p>
          <p className="text-xs text-zinc-500">Mengalihkan ke halaman login...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 space-y-4">
          {step === "otp" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
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

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {loading ? "Mengirim..." : "Kirim OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
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
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  OTP dikirim ke WhatsApp {phone}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500">Password Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  maxLength={72}
                  className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500">Konfirmasi Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => handleConfirmChange(e.target.value)}
                  placeholder="Ulangi password baru"
                  maxLength={72}
                  className="w-full p-2.5 border rounded-lg mt-1 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {loading ? "Memproses..." : "Reset Password"}
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => router.push("/auth")}
              className="text-sm text-zinc-500 hover:text-green-700 dark:hover:text-green-300 font-medium"
            >
              ← Kembali ke Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><p className="text-zinc-500">Memuat...</p></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
