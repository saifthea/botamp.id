import { NextResponse } from "next/server";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo";
import {
  getBiteShipRates,
  convertBiteShipRates, 
  STORE_ORIGIN_POSTAL_CODE,
  BITESHIP_COURIERS,
  getBiteShipCityById,
  geocodePostalCode
} from "@/lib/biteship";

export async function POST(req: Request) {
  try {
    const { destination_postal_code, weight, courier, city_name, destination_lat, destination_lng, city_id } = await req.json();
    const w = weight || 1000;

    console.log("[Shipping API] Received:", {
      destination_postal_code,
      weight: w,
      courier,
      city_name,
      destination_lat,
      destination_lng,
      city_id,
    });

    // Validasi parameter wajib
    if (!destination_postal_code) {
      return NextResponse.json({ 
        success: false, 
        error: "Destination postal code is required" 
      }, { status: 400 });
    }

    // If city_id is provided, fetch coordinates from BiteShip Maps API
    let finalLat = destination_lat;
    let finalLng = destination_lng;
    
    if (!finalLat && !finalLng && city_id) {
      try {
        const city = await getBiteShipCityById(city_id);
        if (city) {
          // Try geocoding by postal code + district for better accuracy
          const coords = await geocodePostalCode(city.postal_code, city.district);
          if (coords) {
            finalLat = coords.latitude;
            finalLng = coords.longitude;
            console.log("[Shipping API] Geocoded coordinates:", { lat: finalLat, lng: finalLng });
          }
        }
      } catch (e) {
        console.warn("[Shipping API] Could not fetch city coordinates:", e);
      }
    }

    // Fallback: geocode by postal code if still no coordinates
    if (!finalLat && !finalLng && destination_postal_code) {
      try {
        const coords = await geocodePostalCode(destination_postal_code, city_name);
        if (coords) {
          finalLat = coords.latitude;
          finalLng = coords.longitude;
          console.log("[Shipping API] Geocoded fallback coordinates:", { lat: finalLat, lng: finalLng });
        }
      } catch (e) {
        console.warn("[Shipping API] Geocoding fallback failed:", e);
      }
    }

    try {
      const payload = {
        origin_postal_code: STORE_ORIGIN_POSTAL_CODE,
        destination_postal_code: destination_postal_code,
        weight: w,
        couriers: courier || BITESHIP_COURIERS,
        destination_lat: finalLat,
        destination_lng: finalLng,
      };

      console.log("[Shipping API] Sending to BiteShip:", JSON.stringify(payload, null, 2));

      const rates = await getBiteShipRates(payload);

      console.log("[Shipping API] BiteShip returned", rates.length, "rates");

      if (rates.length > 0) {
        const results = convertBiteShipRates(rates);
        return NextResponse.json({ 
          success: true, 
          data: results, 
          source: "biteship",
          // Include distance info for UI
          distance_km: finalLat && finalLng ? calculateDistanceToStore(finalLat, finalLng) : null,
          // Include coordinates for Midtrans validation
          destination_lat: finalLat,
          destination_lng: finalLng,
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          error: "No shipping rates available for this destination" 
        }, { status: 404 });
      }
    } catch (apiErr: any) {
      console.error("[Shipping API] BiteShip API error:", apiErr.message, apiErr);
      return NextResponse.json({ 
        success: false, 
        error: apiErr.message || "Failed to fetch shipping rates from BiteShip" 
      }, { status: 502 });
    }
  } catch (e: any) {
    console.error("[Shipping API] Error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}

// Helper to calculate distance from store
function calculateDistanceToStore(lat: number, lng: number): number {
  const STORE_LAT = -6.4680334;
  const STORE_LNG = 106.829002;
  const R = 6371;
  const dLat = (lat - STORE_LAT) * Math.PI / 180;
  const dLng = (lng - STORE_LNG) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
    Math.cos(STORE_LAT * Math.PI/180) * Math.cos(lat * Math.PI/180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 100) / 100;
}