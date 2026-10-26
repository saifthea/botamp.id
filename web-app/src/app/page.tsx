import Image from "next/image";
import { config } from "@/config";
import products from "@/products.json";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
}

const featuredProducts = products.slice(0, 4);

const announcements = [
  { text: "🎉 Promo Spesial: Diskon 15% untuk semua varian botol hingga 31 Oktober!" },
  { text: "📅 Libur toko: Minggu, 25 Oktober 2026 - Pengiriman kembali Senin." },
  { text: "🚚 Free ongkir untuk pembelian di atas Rp500.000 ke seluruh Indonesia." },
  { text: "⚡ Pengiriman SameDay tersedia untuk area Jakarta dan sekitarnya." },
];

const HomePage = () => {
  return (
    <div className="space-y-12">
      {/* Banner Hero - Proporsional */}
      <section className="relative h-[280px] sm:h-[360px] lg:h-[440px] rounded-2xl overflow-hidden shadow-xl bg-gradient-to-r from-green-800 to-green-600">
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 w-full flex items-center justify-between">
            <div className="text-white max-w-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-white overflow-hidden flex-shrink-0">
                  <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-cover" />
                </div>
                <span className="font-bold text-lg">{config.brandName}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-2 leading-tight">
                Packaging,
              </h2>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-2 leading-tight">
                Presenting
              </h2>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 leading-tight">
                Your Product's Perfection
              </h2>
              <p className="text-white/80 text-sm sm:text-base mb-6">
                Solusi kemasan botol plastik berkualitas tinggi dengan desain menarik.
              </p>
              <a
                href="/catalog"
                className="inline-block bg-white text-green-800 px-6 py-3 rounded-full font-bold hover:bg-green-50 transition-colors w-fit"
              >
                Lihat Katalog
              </a>
            </div>
            <div className="hidden lg:block relative w-full max-w-md h-[400px]">
              <Image
                src="/banner-product.jpg"
                alt="Produk"
                fill
                className="object-contain drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Announcement Ticker - Berjalan Otomatis */}
      <section className="bg-green-900 dark:bg-green-950 rounded-xl overflow-hidden border border-green-800 dark:border-green-700">
        <div className="flex animate-marquee whitespace-nowrap py-3">
          {[...announcements, ...announcements].map((a, i) => (
            <span key={i} className="text-white/90 text-sm px-8">
              {a.text}
            </span>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-green-900 dark:text-green-100">Produk Unggulan</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredProducts.map((product) => (
            <div key={product.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-green-100 dark:border-green-900 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative aspect-square">
                <Image
                  src={product.images[0] || "/placeholder.jpg"}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-sm line-clamp-2 mb-1 text-zinc-800 dark:text-zinc-200">{product.name}</h3>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-green-700 dark:text-green-300 text-sm">
                    Rp{product.price.toLocaleString("id-ID")}
                  </span>
                  <a
                    href={`/products/${product.id}`}
                    className="text-xs text-green-600 hover:text-green-800 font-medium"
                  >
                    Lihat →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section className="bg-green-100 dark:bg-green-900/30 rounded-2xl p-6 sm:p-8 border border-green-200 dark:border-green-800">
        <h2 className="text-2xl font-bold mb-3 text-green-900 dark:text-green-100">Tentang {config.brandName}</h2>
        <p className="text-green-800 dark:text-green-200 leading-relaxed">
          {config.brandName} menyediakan produk berkualitas tinggi dengan harga terjangkau.
          Kami melayani pengiriman cepat ke seluruh Indonesia.
        </p>
      </section>
    </div>
  );
};

export default HomePage;