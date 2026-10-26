import { NextResponse } from "next/server";
import { searchBiteShipCities } from "@/lib/biteship";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  try {
    // Use BiteShip API for city search
    if (q.trim().length >= 2) {
      const biteshipCities = await searchBiteShipCities(q, 20);
      if (biteshipCities.length > 0) {
        // Convert to our internal format
        const cities = biteshipCities.map((city, index) => ({
          id: city.id || index + 1,
          name: city.name,
          province: city.province,
          postal_code: city.postal_code,
          type: city.type,
        }));
        return NextResponse.json({ data: cities, source: "biteship" });
      }
    }
  } catch (apiErr) {
    console.log("BiteShip cities API error:", apiErr);
  }

  // Fallback: return empty array (we rely on BiteShip for city data now)
  return NextResponse.json({ data: [], source: "none", error: "City search unavailable" });
}