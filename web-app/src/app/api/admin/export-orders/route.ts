import { NextResponse } from "next/server";
import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

export async function GET(req: Request) {

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";

  const snapshot = await getDocs(
    query(collection(db, "pesanan"), orderBy("createdAt", "desc"))
  );

  const orders = snapshot.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      orderId: data.orderId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      address: data.address,
      city: data.city,
      items: data.items || [],
      subtotal: data.subtotal,
      shippingCost: data.shippingCost,
      courier: data.courier,
      service: data.service,
      service_type: data.service_type,
      total: data.total,
      notes: data.notes,
      status: data.status || "pending",
      paymentStatus: data.paymentStatus || "non_paid",
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  });

  // Filter by date range if provided
  const filtered = dateFrom || dateTo
    ? orders.filter((o) => {
        const dt = new Date(o.createdAt);
        const start = dateFrom ? new Date(dateFrom) : new Date(0);
        const end = dateTo ? new Date(dateTo + "T23:59:59") : new Date("9999-12-31");
        return dt >= start && dt <= end;
      })
    : orders;

  // Generate filename from date range
  const fmtDate = (d: string) => d.replace(/-/g, "");
  const filename = (() => {
    if (dateFrom && dateTo) return `pesanan-${fmtDate(dateFrom)}-${fmtDate(dateTo)}`;
    if (dateFrom) return `pesanan-${fmtDate(dateFrom)}-all`;
    if (dateTo) return `pesanan-all-${fmtDate(dateTo)}`;
    return "pesanan";
  })();

  if (format === "csv") {
    const header = [
      "No. Pesanan",
      "Status Order",
      "Status Pembayaran",
      "SKU Induk",
      "SKU Varian",
      "Nama Produk",
      "Nama Variasi",
      "Harga",
      "Jumlah",
      "Berat Produk",
      "Ongkos Kirim",
      "Total Pembayaran",
      "Catatan dari Pembeli",
      "Nama Penerima",
      "No. Telepon",
      "alamat Pengiriman",
      "Kota/Kabupaten",
      "Provinsi"
    ].join(",");

    const rows: string[] = [];

    for (const o of filtered) {
      const items = o.items.length > 0 ? o.items : [{
        productName: "Produk",
        variantName: "Standard",
        sku: "",
        parentSku: "",
        quantity: 1,
        price: o.subtotal,
        weight: 200,
        total: o.subtotal
      }];

      for (const item of items) {
        rows.push([
          `"${o.orderId}"`,
          `"${o.status || "pending"}"`,
          `"${o.paymentStatus || "non_paid"}"`,
          `"${item.parentSku || item.sku || "-"}"`,
          `"${item.sku || "-"}"`,
          `"${(item.productName || item.name || "").replace(/"/g, '""')}"`,
          `"${(item.variantName || "").replace(/"/g, '""')}"`,
          item.price || 0,
          item.quantity || 1,
          `"${item.weight || 200} gr"`,
          o.shippingCost || 0,
          o.total || 0,
          `"${(o.notes || "").replace(/"/g, '""')}"`,
          `"${(o.customerName || "").replace(/"/g, '""')}"`,
          `"${o.customerPhone || ""}"`,
          `"${(o.address || "").replace(/"/g, '""')}"`,
          `"${(o.city || "").replace(/"/g, '""')}"`,
          `"JATENG/JABODETABEK"`
        ].join(","));
      }
    }

    const csv = [header, ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  return NextResponse.json(filtered, {
    headers: { "x-filename": `${filename}.json` },
  });
}