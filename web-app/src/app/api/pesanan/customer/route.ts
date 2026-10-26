/**
 * API: GET /api/pesanan/customer?phone=628123456789
 * Mengambil pesanan berdasarkan nomor telepon customer
 * Menormalisasi data agar field numeric selalu ada (fallback 0).
 * Mendukung format lama (migrasi Firestore) dan format baru.
 */
import { NextResponse } from "next/server";
import { db, collection, getDocs, query, where, orderBy } from "@/lib/mongo";

function normalizeOrder(raw: any): any {
  const orderId = raw.orderId || (raw["No"] as any)?.[" Pesanan"]?.toString() || raw.id;
  const customerPhone = raw.customerPhone || (raw["No"] as any)?.[" Telepon"]?.toString() || "";
  const customerName = raw.customerName || raw["Nama Penerima"] || "";
  const address = raw.address || raw["Alamat Pengiriman"] || "";
  const city = raw.city || raw["Kota/Kabupaten"] || "";
  const total = Number(raw.total) || Number(raw["Total Pembayaran"]) || 0;
  const shippingCost = Number(raw.shippingCost) || Number(raw["Ongkos Kirim"]) || 0;
  const subtotal = Number(raw.subtotal) || total - shippingCost;
  const paymentStatus = raw.paymentStatus || "non_paid";
  const status = raw.status || "pending";
  const serviceType = raw.service_type || ((raw.courier?.toLowerCase().includes("instant") || raw.service?.toLowerCase().includes("instant")) ? "instant" : "reguler");
  const rawCreatedAt = raw.createdAt || null;
  // Convert createdAt to ISO string for reliable JSON serialization
  let isoCreatedAt: string | null = null;
  if (rawCreatedAt) {
    if (typeof rawCreatedAt === "string") {
      isoCreatedAt = rawCreatedAt;
    } else if (typeof rawCreatedAt === "object" && (rawCreatedAt as any).seconds != null) {
      const ms = ((rawCreatedAt as any).seconds * 1000) + ((rawCreatedAt as any).nanoseconds / 1_000_000);
      isoCreatedAt = new Date(ms).toISOString();
    } else if (rawCreatedAt instanceof Date) {
      isoCreatedAt = rawCreatedAt.toISOString();
    }
  }
  const createdAt = isoCreatedAt;

  // Normalize items
  let items = raw.items;
  const isOldFormat = raw["Nama Produk"];
  if ((!items || typeof items !== "object" || Array.isArray(items) === false) && isOldFormat) {
    const qty = Number(raw["Jumlah"]) || 1;
    const price = Number(raw["Harga"]) || 0;
    items = [
      {
        productName: raw["Nama Produk"],
        variantName: raw["Nama Variasi"] || "",
        sku: raw["SKU Varian"] || raw["SKU Induk"] || "",
        quantity: qty,
        price: price,
        total: price * qty,
      },
    ];
  } else if (items && Array.isArray(items)) {
    items = items.map((item: any) => ({
      productName: item.productName || item.namaProduk || "",
      variantName: item.variantName || item.namaVarian || "",
      sku: item.sku || item.SKU || "",
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      total: Number(item.total) || 0,
    }));
  }

  return {
    ...raw,
    id: raw.id || String(raw._id),
    orderId,
    customerPhone,
    customerName,
    address,
    city,
    total,
    subtotal,
    shippingCost,
    paymentStatus,
    status,
    service_type: serviceType,
    createdAt,
    items,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone");

    if (!phone) {
      return NextResponse.json({ error: "Nomor telepon diperlukan" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const q = query(collection(db, "pesanan"), where("customerPhone", "==", cleanPhone), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const pesanan = snapshot.docs.map((d) => normalizeOrder(d.data()));

    // Fallback sort
    pesanan.sort((a: any, b: any) => {
      const aTime = a.createdAt?.seconds ?? 0;
      const bTime = b.createdAt?.seconds ?? 0;
      if (aTime !== bTime) return bTime - aTime;
      return (b.id ?? "").localeCompare(a.id ?? "");
    });

    return NextResponse.json({ pesanan });
  } catch (e: any) {
    console.error("[pesanan/customer] Error:", e?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}