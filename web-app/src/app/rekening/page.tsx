"use client";

import Image from "next/image";
import Link from "next/link";
import { config } from "@/config";

export default function RekeningPage() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-green-800 dark:text-green-200">Instruksi Pembayaran</h1>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-green-200 dark:border-green-800 p-6 space-y-4">
        <h2 className="font-bold text-lg text-green-700 dark:text-green-300 border-b border-green-200 dark:border-green-800 pb-2">
          Nomor Rekening Transfer
        </h2>

        <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {config.rekening.bank.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-green-800 dark:text-green-200 text-lg">{config.rekening.bank}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Bank Syariah Indonesia</p>
            </div>
          </div>

          <div className="pt-3 border-t border-green-200 dark:border-green-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400 text-sm">Nama Pemilik</span>
              <span className="font-semibold text-green-800 dark:text-green-200">{config.rekening.nama}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400 text-sm">No. Rekening</span>
              <span className="font-mono font-bold text-lg text-green-700 dark:text-green-300 tracking-widest">
                {config.rekening.nomor}
              </span>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ Lakukan pembayaran sesuai total yang tertera. Kirim bukti transfer via WhatsApp setelah selesai.
          </div>
        </div>

        <Link
          href="/checkout"
          className="block text-center w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Lanjut Checkout
        </Link>
      </div>

      <p className="text-center text-sm text-zinc-500">
        Transfer ke rekening di atas, lalu kirim bukti ke WhatsApp admin.
      </p>
    </div>
  );
}
