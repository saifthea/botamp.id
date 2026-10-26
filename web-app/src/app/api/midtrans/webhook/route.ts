import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"
import { createHash } from "crypto";
import { createBiteShipShipment, STORE_ORIGIN_POSTAL_CODE } from "@/lib/biteship";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;

    // Verify signature
    const signature = createHash("sha512")
      .update(body + SERVER_KEY)
      .digest("hex");

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new NextResponse("Invalid content type", { status: 400 });
    }

    const notification = JSON.parse(body);
    console.log("Midtrans notification:", notification);

    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    // Update order status in Firestore
    const orderDocRef = doc(db, "pesanan", orderId);
    const orderDoc = await getDoc(orderDocRef);

    if (orderDoc.exists()) {
      let status = "belum_dibayar";
      let waybillNumber = undefined;
      let courierCode = undefined;

      if (transactionStatus === "capture" || transactionStatus === "settlement") {
        status = fraudStatus === "challenge" ? "komplain diajukan" : "dikemas";
      } else if (transactionStatus === "deny") {
        status = "dibatalkan";
      } else if (transactionStatus === "cancel" || transactionStatus === "expire") {
        status = "dibatalkan";
      } else if (transactionStatus === "pending") {
        status = "belum_dibayar";
      }

      const updateData: Record<string, any> = {
        status,
        paymentStatus: status === "dibatalkan" ? "dibatalkan" : (status === "belum_dibayar" ? "non_paid" : "paid"),
        midtransNotification: notification,
        updatedAt: new Date().toISOString(),
      };

      // Create Biteship waybill when order is paid and no waybill yet
      if (status === "dikemas" && !orderDoc.data().waybillNumber) {
        const d = orderDoc.data();
        const courier = d.courier || "";
        const service = d.service || "reguler";

        // Skip instant delivery - no Biteship waybill for instant
        if (courier && d.service_type !== "instant") {
          const originPhone = process.env.WHATSAPP_NUMBER || "6285695316096";
          const items = (d.items || []).map((item: any) => ({
            name: item.productName || item.name || "Produk",
            weight: Math.max(100, Math.round((item.total || item.price || 0) / 1000)),
            qty: item.quantity || 1,
          }));
          const totalWeight = items.reduce((sum: number, i: any) => sum + (i.weight * i.qty), 0) || 1000;

          try {
            const result = await createBiteShipShipment({
              courier,
              service,
              items,
              weight: totalWeight,
              origin: {
                name: "Botamp.id",
                phone: originPhone,
                address: "Jl. Cibinong Raya No. 1",
                postal_code: STORE_ORIGIN_POSTAL_CODE,
              },
              destination: {
                name: d.customerName || "Customer",
                phone: (d.customerPhone || "").replace(/\D/g, ""),
                address: d.address || "",
                postal_code: d.postal_code || "",
              },
            });

            if (result.success && result.data?.waybill_number) {
              waybillNumber = result.data.waybill_number;
              courierCode = (result.data as any).courier || courier;
              console.log("[Webhook] Waybill created:", waybillNumber);
            } else {
              console.error("[Webhook] Biteship failed:", result.message);
            }
          } catch (biteshipErr) {
            console.error("[Webhook] Biteship error:", biteshipErr);
          }
        }
      }

      if (waybillNumber) updateData.waybillNumber = waybillNumber;
      if (courierCode) updateData.courier = courierCode;

      await updateDoc(orderDocRef, updateData);
    }

    return new NextResponse("OK", { status: 200 });
  } catch (e: any) {
    console.error("Midtrans webhook error:", e);
    return new NextResponse(e.message || "Internal server error", { status: 500 });
  }
}