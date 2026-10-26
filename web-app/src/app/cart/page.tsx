"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

export default function CartPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [inactiveProducts, setInactiveProducts] = useState<string[]>([]);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem("cart") || "[]");
    setCartItems(savedCart);
  }, []);

  // Validasi status produk saat cart dibuka
  useEffect(() => {
    const checkProductStatus = async () => {
      if (cartItems.length === 0) {
        setCheckingStatus(false);
        return;
      }

      const inactive: string[] = [];
      for (const item of cartItems) {
        try {
          const res = await fetch(`/api/products/${item.productId}`);
          const product = await res.json();
          if (!res.ok || !product || product.isActive === false) {
            inactive.push(item.productName);
          }
        } catch (e) {
          console.error(`Error checking product ${item.productId}:`, e);
        }
      }
      setInactiveProducts(inactive);
      setCheckingStatus(false);
    };

    checkProductStatus();
  }, [cartItems.length]);

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cartItems];
    const item = newCart[index];
    const maxStock = item.maxStock || 9999;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      newCart.splice(index, 1);
    } else if (newQty > maxStock) {
      alert(`⚠️ Stok variant hanya ${maxStock} pcs.`);
      newCart[index].quantity = maxStock;
    } else {
      newCart[index].quantity = newQty;
    }
    setCartItems(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  const removeItem = (index: number) => {
    const newCart = cartItems.filter((_, i) => i !== index);
    setCartItems(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  const totalWeight = cartItems.reduce(
    (acc, item) => acc + (item.weight || 200) * item.quantity,
    0
  );

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Keranjang Belanja</h1>

      {/* Peringatan produk nonaktif */}
      {inactiveProducts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-lg">⚠️</span>
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">
                Produks berikut sudah tidak tersedia:
              </p>
              <ul className="mt-1 text-sm text-red-600 dark:text-red-300 list-disc list-inside">
                {inactiveProducts.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {cartItems.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <p className="text-zinc-500 mb-4">Keranjang Anda masih kosong.</p>
          <Link
            href="/catalog"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-blue-700"
          >
            Mulai Belanja
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item, idx) => {
              const isInactive = inactiveProducts.includes(item.productName);
              return (
                <div
                  key={idx}
                  className={`flex gap-4 p-4 bg-white dark:bg-zinc-900 rounded-xl border items-center transition-colors ${
                    isInactive
                      ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.productName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-zinc-400">
                        No Image
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-sm sm:text-base truncate">
                      {item.productName}
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Varian: {item.variantName}
                    </p>
                    {isInactive && (
                      <p className="text-xs text-red-500 font-medium mt-1">
                        Sudah tidak tersedia
                      </p>
                    )}
                    <p className="font-bold text-sm text-blue-600 dark:text-blue-400 mt-1">
                      Rp{item.price.toLocaleString("id-ID")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateQuantity(idx, -1)}
                        disabled={isInactive}
                        className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-xs font-bold disabled:opacity-50"
                      >
                        -
                      </button>
                      <span className="px-3 text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(idx, 1)}
                        disabled={isInactive}
                        className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-xs font-bold disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(idx)}
                      className="text-red-500 hover:text-red-700 text-sm p-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 h-fit space-y-4">
            <h2 className="font-bold text-lg border-b pb-3">Ringkasan Belanja</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Total Item</span>
                <span>{cartItems.reduce((acc, i) => acc + i.quantity, 0)} item</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Total Berat Estimasi</span>
                <span>{totalWeight} gram</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t">
                <span>Subtotal Produk</span>
                <span>Rp{subtotal.toLocaleString("id-ID")}</span>
              </div>
            </div>

            {inactiveProducts.length > 0 ? (
              <div className="space-y-2">
                <button
                  disabled
                  className="block text-center w-full bg-zinc-400 text-white font-bold py-3 rounded-xl cursor-not-allowed"
                >
                  Tidak Bisa Checkout
                </button>
                <p className="text-xs text-center text-red-500">
                  Hapus produk tidak tersedia terlebih dahulu
                </p>
              </div>
            ) : (
              <Link
                href="/checkout"
                className="block text-center w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all"
              >
                Lanjut ke Checkout
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
