"use client";

import { useState } from "react";
import { config } from "@/config";
import { useAuth } from "@/contexts/AuthContext";

export default function Navbar() {
  const { customer, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-green-800 dark:bg-green-950 backdrop-blur-sm shadow-lg">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <a href="/" className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-full overflow-hidden bg-white flex items-center justify-center">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-xl font-bold text-white">{config.brandName}</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-4">
          <a href="/" className="text-green-100 hover:text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">Home</a>
          <a href="/catalog" className="text-green-100 hover:text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">Catalog</a>
          <a href="/rekening" className="text-green-100 hover:text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">Rekening</a>
          {customer ? (
            <>
              <a href="/profile" className="text-green-100 hover:text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2">
                <span className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
                {customer.name.split(" ")[0]}
              </a>
              <button
                onClick={() => { logout(); }}
                className="text-green-100 hover:text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Keluar
              </button>
            </>
          ) : (
            <a href="/auth" className="bg-white text-green-800 hover:bg-green-100 px-3 py-2 rounded-lg transition-colors text-sm font-bold">Masuk</a>
          )}
        </nav>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-white p-2 rounded-lg hover:bg-green-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-green-900 border-t border-green-700 px-4 py-3 space-y-2">
          <a href="/" onClick={() => setMobileOpen(false)} className="block text-green-100 hover:text-white py-2 text-sm font-medium">Home</a>
          <a href="/catalog" onClick={() => setMobileOpen(false)} className="block text-green-100 hover:text-white py-2 text-sm font-medium">Catalog</a>
          <a href="/rekening" onClick={() => setMobileOpen(false)} className="block text-green-100 hover:text-white py-2 text-sm font-medium">Rekening</a>
          {customer ? (
            <>
              <a href="/profile" onClick={() => setMobileOpen(false)} className="block text-green-100 hover:text-white py-2 text-sm font-medium">
                👤 {customer.name}
              </a>
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="block text-red-300 hover:text-red-200 py-2 text-sm font-medium w-full text-left"
              >
                Keluar
              </button>
            </>
          ) : (
            <a href="/auth" onClick={() => setMobileOpen(false)} className="block bg-white text-green-800 hover:bg-green-100 px-3 py-2 rounded-lg text-sm font-bold text-center">Masuk</a>
          )}
        </div>
      )}
    </header>
  );
}
