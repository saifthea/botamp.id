"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

import productsData from "@/products.json";

export default function CatalogPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetch("/api/products/all");
        const data = await res.json();
        const fetchedProducts: any[] = Array.isArray(data) ? data : (data.products || []);
        // Hapus duplicate berdasarkan ID (pertahankan yang pertama)
        const seen = new Set<string>();
        const unique = fetchedProducts.filter((p: any) => {
          const pid = p.id || "";
          if (seen.has(pid)) {
            console.warn(`Duplicate product ID ditemukan dan diabaikan di katalog: ${pid}`);
            return false;
          }
          seen.add(pid);
          return true;
        });
        setProducts(unique);
        setError(null);
      } catch (e: any) {
        console.error("Failed to load products:", e);
        setProducts(productsData);
        setError("Gagal memuat produk dari Firebase. Menggunakan data lokal.");
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return ["All", ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (product.isActive === false) return false;
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500">Memuat katalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl font-bold">Katalog Produk ({filteredProducts.length})</h1>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Cari produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {filteredProducts.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
          >
            <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-800">
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-400">
                  No Image
                </div>
              )}
            </div>
            <div className="p-4 flex flex-col flex-1">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                {product.category}
              </span>
              <h2 className="font-semibold text-sm sm:text-base line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
                {product.name}
              </h2>
              <div className="mt-auto flex items-center justify-between">
                <span className="font-bold text-base sm:text-lg">
                  Rp{product.price.toLocaleString("id-ID")}
                </span>
                <span className="text-xs text-zinc-500">
                  {product.variants?.length ?? 0} varian
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          Tidak ada produk yang sesuai dengan pencarian.
        </div>
      )}
    </div>
  );
}
