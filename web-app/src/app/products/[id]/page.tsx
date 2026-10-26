"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import ChatButton from "@/components/ChatButton";

interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  weight: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  images: string[];
  variants: ProductVariant[];
}

interface ProductDetailProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailPage({ params }: ProductDetailProps) {
  const resolvedParams = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatting, setChatting] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const res = await fetch(`/api/products/${resolvedParams.id}`);
        const data = await res.json();
        if (res.ok && data) {
          setProduct(data);
          if (data.images?.length > 0) setSelectedImage(data.images[0]);
          if (data.variants?.length > 0) setSelectedVariant(data.variants[0]);
        }
      } catch (e) {
        console.error("Gagal memuat produk:", e);
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-pulse text-zinc-400">Memuat produk...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Produk Tidak Ditemukan</h1>
        <Link href="/catalog" className="text-blue-600 hover:underline">
          Kembali ke Katalog
        </Link>
      </div>
    );
  }

  const handleChatProduct = () => {
    if (!product) return;
    const origin = window.location.origin;
    const productUrl = `${origin}/products/${product.id}`;
    const variantInfo = selectedVariant ? `\n📐 Varian: ${selectedVariant.name}` : "";
    const msg = `Halo min, saya tertarik dengan produk ini:\n\n🛍️ ${product.name}\n💰 Rp${(selectedVariant?.price || product.price).toLocaleString("id-ID")}${variantInfo}\n📦 Stok: ${selectedVariant?.stock ?? product.stock} pcs\n🔗 ${productUrl}`;
    // Simpan ke localStorage agar ChatButton bisa membaca dan membuka chat otomatis
    localStorage.setItem("chat_preload_msg", JSON.stringify({ msg, id: product.id }));
    // Buka chat langsung (trigger event)
    window.dispatchEvent(new Event("chat_product_request"));
  };

  const addToCart = () => {
    if (!selectedVariant) return;
    const maxStock = selectedVariant.stock ?? 0;
    if (maxStock === 0) {
      alert("⚠️ Stok variant ini habis, tidak dapat ditambahkan ke keranjang.");
      return;
    }
    if (quantity > maxStock) {
      alert(`⚠️ Stok hanya tersedia ${maxStock} pcs. Jumlah diatur ke ${maxStock}.`);
      setQuantity(maxStock);
      return;
    }

    const cartItem = {
      productId: product.id,
      productName: product.name,
      variantSku: selectedVariant.sku || "",
      variantId: selectedVariant.sku || "",
      variantName: selectedVariant.name,
      price: selectedVariant.price || product.price,
      weight: selectedVariant.weight || 200,
      image: selectedImage || product.images[0],
      quantity: quantity,
      sku: selectedVariant.sku || "",
      parentSku: product.sku || "",
      maxStock: maxStock,
    };

    const existingCart = JSON.parse(localStorage.getItem("cart") || "[]");
    const index = existingCart.findIndex(
      (item: any) =>
        item.productId === cartItem.productId && item.variantSku === cartItem.variantSku
    );

    if (index > -1) {
      const currentQty = existingCart[index].quantity || 0;
      if (currentQty + quantity > maxStock) {
        alert(`⚠️ Total stok variant hanya ${maxStock} pcs. Keranjang sudah ada ${currentQty} pcs.`);
        return;
      }
      existingCart[index].quantity += quantity;
    } else {
      existingCart.push(cartItem);
    }

    localStorage.setItem("cart", JSON.stringify(existingCart));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <Link href="/catalog" className="text-sm text-zinc-500 hover:text-black flex items-center gap-1">
        ← Kembali ke Katalog
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        {/* Galeri Gambar */}
        <div className="space-y-4">
          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
            {selectedImage ? (
              <Image
                src={selectedImage}
                alt={product.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-400">
                No Image Available
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 ${
                    selectedImage === img ? "border-blue-600" : "border-transparent"
                  }`}
                >
                  <Image src={img} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info & Pilihan Varian */}
        <div className="flex flex-col justify-between space-y-6">
          <div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {product.category}
            </span>
            <h1 className="text-2xl font-bold mt-1 mb-2">{product.name}</h1>
            <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mb-6">
              Rp{(selectedVariant?.price || product.price).toLocaleString("id-ID")}
            </p>

            {/* Pilihan Varian */}
            {product.variants.length > 0 && (
              <div className="space-y-3 mb-6">
                <label className="text-sm font-semibold">Pilih Varian:</label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant, idx) => {
                    const isOutOfStock = (variant.stock ?? 0) === 0;
                    return (
                      <button
                        key={`${variant.id}-${idx}`}
                        onClick={() => {
                          if (isOutOfStock) {
                            alert("⚠️ Stok variant ini habis, tidak dapat ditambahkan ke keranjang.");
                            return;
                          }
                          setSelectedVariant(variant);
                        }}
                        disabled={isOutOfStock}
                        className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                          isOutOfStock
                            ? "border-red-200 bg-red-50/50 text-red-400 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30 cursor-not-allowed opacity-60"
                            : selectedVariant?.sku === variant.sku
                            ? "border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-semibold"
                            : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400"
                        }`}
                      >
                        {variant.name} - Rp{variant.price.toLocaleString("id-ID")}
                        {isOutOfStock && " (Habis)"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Jumlah */}
            <div className="space-y-2 mb-6">
              <label className="text-sm font-semibold">Jumlah:</label>
              <div className="flex items-center border border-zinc-300 dark:border-zinc-700 w-fit rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200"
                >
                  -
                </button>
                <span className="px-4 font-semibold">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleChatProduct}
              disabled={chatting}
              className="w-full py-3 px-6 rounded-xl font-bold transition-all bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 text-white shadow-lg shadow-green-600/30 flex items-center justify-center gap-2"
            >
              {chatting ? (
                <span>Mengirim pesan...</span>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                  </svg>
                  Tanya Produk Ini
                </>
              )}
            </button>
            <button
              onClick={addToCart}
              className={`w-full py-3 px-6 rounded-xl font-bold transition-all ${
                added
                  ? "bg-green-600 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30"
              }`}
            >
              {added ? "✓ Berhasil Ditambahkan!" : "+ Tambah ke Keranjang"}
            </button>
            <Link
              href="/cart"
              className="block text-center w-full py-3 px-6 rounded-xl font-semibold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Lihat Keranjang & Checkout
            </Link>
          </div>
        </div>
      </div>

      {/* Deskripsi */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-bold mb-4">Deskripsi Produk</h2>
        <div className="whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {product.description}
        </div>
      </div>

      {/* Tombol floating - chat window di halaman produk */}
      <ChatButton />
    </div>
  );
}
