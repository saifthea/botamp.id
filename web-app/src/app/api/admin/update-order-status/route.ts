import { NextResponse } from "next/server";
import { db, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"
import { isValidToken } from "@/app/api/admin/session/route";
import { createBiteShipShipment } from "@/lib/biteship";
import { STORE_COORDINATES } from "@/config";

async function verify(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("AdminSession ")) return false;
  const token = auth.replace("AdminSession ", "");
  return await isValidToken(token);
}

export async function POST(req: Request) {
  if (!await verify(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { orderId, action } = body;

  if (!orderId || !action) {
    return NextResponse.json({ error: "Missing orderId or action" }, { status: 400 });
  }

  // Find order by orderId field
  let q = query(collection(db, "pesanan"), where("orderId", "==", orderId));
  let snapshot = await getDocs(q);
  if (snapshot.docs.length === 0) {
    try {
      const q2 = query(collection(db, "pesanan"), where("_id", "==", orderId));
      snapshot = await getDocs(q2);
    } catch {}
  }

  if (snapshot.docs.length === 0) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const docId = snapshot.docs[0].id;
  const orderData = snapshot.docs[0].data();

  if (action === "markPrinted") {
    await updateDoc(doc(db, "pesanan", docId), {
      status: "printed",
      printedAt: new Date().toISOString(),
    });
  }

  if (action === "cancel") {
    await updateDoc(doc(db, "pesanan", docId), {
      paymentStatus: "dibatalkan",
      status: "dibatalkan",
      canceledAt: new Date().toISOString(),
    });

    // Kembalikan stok product
    const items = (orderData.items || []).map((it: any) => ({
      productId: it.id_products || it.productId,
      variantId: it.variantId,
      quantity: it.quantity,
    }));
    if (items.length > 0) {
      try {
        await fetch("/api/products/update-stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, mode: "restore" }),
        });
      } catch (restoreErr: any) {
        console.error("[update-order-status] Gagal restore stok:", restoreErr?.message);
      }
    }
  }

  if (action === "simulatePayment") {
    const isInstant = orderData.service_type === "instant";
    let waybillNumber = orderData.waybillNumber;
    let courierName = orderData.courier;

    // Auto-create Biteship waybill for regular, or just proceed for instant
    if (!waybillNumber && orderData.courier) {
      if (!isInstant) {
        try {
          const shipment = await createBiteShipShipment({
            origin: {
              name: "Botamp",
              phone: "6285695316096",
              address: "Cibinong, Bogor",
              postal_code: STORE_COORDINATES.originPostalCode,
            },
            destination: {
              name: orderData.customerName,
              phone: orderData.customerPhone || "",
              address: orderData.address,
              postal_code: orderData.postal_code || "",
            },
            courier: orderData.courier,
            service: orderData.service || "reg",
            items: [{ name: "Produk", weight: 1000, qty: 1 }],
            weight: 1000,
          });
          waybillNumber = (shipment as any)?.data?.waybill_number;
          courierName = (shipment as any)?.data?.courier_company || orderData.courier;
        } catch (e: any) {
          console.error("[Test] Waybill creation failed:", e.message || e);
        }
      } else {
        // Untuk instan, beri nomor simulasi agar status berubah
        waybillNumber = "INSTAN-" + orderId;
      }
    }

    const updateData: any = {
      status: "paid",
      paymentStatus: "paid",
      shippedAt: new Date().toISOString(),
      courier: courierName || orderData.courier,
    };
    if (waybillNumber) updateData.waybillNumber = waybillNumber;

    // Use doc(db, "collection", docId) to get correct reference for updateDoc
    await updateDoc(doc(db, "pesanan", docId), updateData);

    return NextResponse.json({ ok: true, waybillNumber });
  }

  return NextResponse.json({ ok: true });
}