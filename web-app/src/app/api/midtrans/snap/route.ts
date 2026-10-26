import { NextResponse } from "next/server";
import { checkInstantDeliveryCoverage } from "@/lib/biteship";
import { getBiteShipCityById, geocodePostalCode } from "@/lib/biteship";
import { MAX_INSTANT_DISTANCE_KM } from "@/config";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

/**
 * Validate shipping method against distance coverage
 * This is a security guard to prevent users from forcing instant/same-day delivery
 * when they are outside the coverage area (> 20km)
 */
async function validateShippingMethod(
  courier: string,
  service: string,
  serviceType: string,
  destinationLat: number | undefined,
  destinationLng: number | undefined,
  cityId: string | undefined
): Promise<{ valid: boolean; error?: string }> {
  // Try to get coordinates if not provided but cityId is available
  let finalLat = destinationLat;
  let finalLng = destinationLng;
  
  if ((!finalLat || !finalLng) && cityId) {
    try {
      const city = await getBiteShipCityById(cityId);
      if (city) {
        // Try to geocode using postal code and district from the city data
        const coords = await geocodePostalCode(city.postal_code, city.district);
        if (coords) {
          finalLat = coords.latitude;
          finalLng = coords.longitude;
          console.log(`[Shipping Validation] Geocoded coordinates from city:`, { lat: finalLat, lng: finalLng });
        }
      }
    } catch (e) {
      console.warn("[Shipping Validation] Could not get or geocode city coordinates:", e);
    }
  }

  // Only validate if coordinates are available
  if (!finalLat || !finalLng) {
    console.log("[Shipping Validation] No coordinates available, skipping distance validation");
    return { valid: true }; // Skip validation if no coordinates
  }

  const { distanceKm, isWithinCoverage } = checkInstantDeliveryCoverage(
    finalLat,
    finalLng
  );

  console.log(`[Shipping Validation] Courier: ${courier}, Service: ${service}, Type: ${serviceType}, Distance: ${distanceKm} km, Within coverage: ${isWithinCoverage}`);

  // If service is instant or same_day but outside coverage, reject
  if ((serviceType === "instant" || serviceType === "same_day") && !isWithinCoverage) {
    return {
      valid: false,
      error: `Maaf, kurir instan/same-day tidak tersedia untuk jarak lebih dari ${MAX_INSTANT_DISTANCE_KM} km. Jarak ke alamat Anda: ${distanceKm} km.`,
    };
  }

  return { valid: true };
}

export async function POST(req: Request) {
  try {
    const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
    if (!SERVER_KEY) {
      return NextResponse.json({ error: "Midtrans not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { 
      orderId, 
      amount, 
      items, 
      customerName, 
      customerPhone, 
      address, 
      city,
      // Shipping validation fields
      shippingCourier,
      shippingService,
      shippingServiceType,
      destinationLat,
      destinationLng,
      cityId,
    } = body;

    console.log("📤 Midtrans snap request:", { orderId, amount, itemCount: items?.length });

    // Validate shipping method against distance coverage (security guard)
    if (shippingCourier && shippingService && shippingServiceType) {
      const validation = await validateShippingMethod(
        shippingCourier,
        shippingService,
        shippingServiceType,
        destinationLat,
        destinationLng,
        cityId
      );
      
      if (!validation.valid) {
        console.error("❌ Shipping validation failed:", validation.error);
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      
      console.log("✅ Shipping validation passed");
    }

    // Validasi required fields
    if (!orderId || !amount) {
      return NextResponse.json({ error: "orderId and amount are required" }, { status: 400 });
    }

    // Ensure amount is integer
    const grossAmount = Math.round(Number(amount));
    if (grossAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Build clean items array (truncate name to avoid Midtrans "too long" error)
    const MAX_NAME_LEN = 50;
    const itemDetails = (items || []).map((item: any) => {
      const rawName = (item.name || item.productName || "Product").trim();
      const name = rawName.length > MAX_NAME_LEN ? rawName.slice(0, MAX_NAME_LEN - 3) + "..." : rawName;
      return {
        id: (item.id || item.sku || "unknown").trim(),
        name,
        price: Math.round(Number(item.price) || 0),
        quantity: Math.round(Number(item.quantity) || 0),
      };
    }).filter((item: any) => item.id && item.price > 0);

    // Hitung total item_details (harus sama dengan grossAmount)
    const itemsTotal = itemDetails.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    let shippingCost = grossAmount - itemsTotal;

    // Jika ada selisih (misal floating point), sesuaikan grossAmount agar exact match
    if (shippingCost < 0) shippingCost = 0;
    if (shippingCost > 0 && itemsTotal + shippingCost !== grossAmount) {
      // Pastikan exact match dengan menyesuaikan item terakhir atau ongkir
      shippingCost = grossAmount - itemsTotal;
    }

    // Tambahkan ongkir sebagai item terpisah jika > 0
    const finalItems = [...itemDetails];
    if (shippingCost > 0) {
      finalItems.push({
        id: "shipping",
        name: "Biaya Pengiriman",
        price: shippingCost,
        quantity: 1,
      });
    }

    const snapBody = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      customer_details: {
        first_name: customerName || "Customer",
        phone: customerPhone || "",
        shipping_address: {
          address: address || "",
          city: city || "",
        },
      },
      item_details: finalItems,
      credit_card: { secure: true },
    };

    console.log("📤 Midtrans request body:", JSON.stringify(snapBody, null, 2));

    const auth = Buffer.from(SERVER_KEY + ":").toString("base64");

    const midtransRes = await fetch("https://api.sandbox.midtrans.com/snap/v1/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify(snapBody),
    });

    const contentType = midtransRes.headers.get("content-type") || "";
    let data;
    if (contentType.includes("json")) {
      data = await midtransRes.json();
    } else {
      const text = await midtransRes.text();
      console.error("Midtrans non-JSON response:", text);
      return NextResponse.json({ error: "Midtrans API error", details: text }, { status: midtransRes.status });
    }

    console.log("📥 Midtrans response:", JSON.stringify(data, null, 2));

    if (!midtransRes.ok) {
      console.error("Midtrans error:", data);
      return NextResponse.json({ error: data.message || "Midtrans error", details: data }, { status: midtransRes.status });
    }

    return NextResponse.json({ token: data.token, redirect_url: data.redirect_url });
  } catch (e: any) {
    console.error("Midtrans snap error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}