/**
 * BiteShip API Integration
 * Documentation: https://docs.biteship.com/
 * Base URL: https://api.biteship.com/v1
 */

import { serverConfig } from "@/config";
import { STORE_COORDINATES, MAX_INSTANT_DISTANCE_KM } from "@/config";

export const BITESHIP_CONFIG = {
  baseUrl: "https://api.biteship.com/v1",
  apiKey: serverConfig.biteshipApiKey,
};

/**
 * Courier category types for whitelist filtering
 */
export type CourierCategory = "regular" | "instant" | "cargo";

/**
 * Whitelist of allowed couriers with their categories
 * Based on business requirements for Botamp.id
 */
export const COURIER_WHITELIST: Record<string, CourierCategory[]> = {
  // Regular & Express couriers (always allowed)
  "jne": ["regular", "cargo"],           // JNE Regular + JNE Cargo (JTR)
  "jnt": ["regular", "cargo"],           // J&T Express + J&T Cargo
  "anteraja": ["regular"],               // Anteraja Regular
   // SAP Express + SAP Cargo
  "lalamove": ["regular", "instant"],    // Lalamove (can be both regular & instant)
  
  // Instant & Same-Day couriers (only within 20km)
  "gosend": ["instant"],                 // GoSend Instant/Same-Day
  "grab": ["instant"],                   // GrabExpress Instant/Same-Day
  "shopeexpress": ["instant"],           // ShopeeXpress Instant
  
  // Cargo-only couriers (always allowed)
  "jnt_cargo": ["cargo"],                // J&T Cargo (separate code)
};

/**
 * Get list of all whitelisted courier codes for API request
 */
export function getWhitelistedCouriers(): string[] {
  return Object.keys(COURIER_WHITELIST);
}

/**
 * Check if a courier is in the whitelist
 */
export function isCourierWhitelisted(courierCode: string): boolean {
  return courierCode in COURIER_WHITELIST;
}

/**
 * Get categories for a specific courier
 */
export function getCourierCategories(courierCode: string): CourierCategory[] {
  return COURIER_WHITELIST[courierCode] || [];
}

/**
 * Check if a courier supports a specific category
 */
export function courierSupportsCategory(courierCode: string, category: CourierCategory): boolean {
  const categories = COURIER_WHITELIST[courierCode];
  return categories ? categories.includes(category) : false;
}

/**
 * Haversine formula to calculate distance between two coordinates in kilometers
 * @param lat1 - Latitude of point 1 (store)
 * @param lng1 - Longitude of point 1 (store)
 * @param lat2 - Latitude of point 2 (destination)
 * @param lng2 - Longitude of point 2 (destination)
 * @returns Distance in kilometers
 */
export function calculateDistanceHaversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if destination is within instant/same-day delivery coverage
 * @param destinationLat - Destination latitude
 * @param destinationLng - Destination longitude
 * @returns Object with distance and whether instant delivery is available
 */
export function checkInstantDeliveryCoverage(
  destinationLat: number,
  destinationLng: number
): { distanceKm: number; isWithinCoverage: boolean } {
  const distanceKmRaw = calculateDistanceHaversine(
    STORE_COORDINATES.latitude,
    STORE_COORDINATES.longitude,
    destinationLat,
    destinationLng
  );
  // Round to one decimal place for user-friendly display
  const distanceKm = Math.round(distanceKmRaw * 10) / 10;
  const TOLERANCE_KM = 1; // allow up to 1 km extra tolerance
  const isWithinCoverage = distanceKm <= MAX_INSTANT_DISTANCE_KM + TOLERANCE_KM;
  return { distanceKm, isWithinCoverage };
}

/**
 * Filter shipping options based on distance coverage and courier whitelist
 * Removes instant/same-day couriers if destination is outside coverage area
 * Also filters out any couriers not in the whitelist
 * @param options - Array of shipping options from BiteShip
 * @param destinationLat - Destination latitude
 * @param destinationLng - Destination longitude
 * @returns Filtered shipping options
 */
export function filterShippingOptionsByDistance(
  options: ShippingOption[],
  destinationLat: number,
  destinationLng: number
): ShippingOption[] {
  const { distanceKm, isWithinCoverage } = checkInstantDeliveryCoverage(
    destinationLat,
    destinationLng
  );
  
  console.log(`[Distance Check] Store to destination: ${distanceKm} km, Within instant coverage: ${isWithinCoverage}`);
  
  // First, filter by whitelist (remove any couriers not in our allowed list)
  const whitelisted = options.filter(option => isCourierWhitelisted(option.courier));
  
  if (whitelisted.length !== options.length) {
    console.log(`[Whitelist Filter] Removed ${options.length - whitelisted.length} non-whitelisted couriers`);
  }
  
  // If within 20km, show all whitelisted options (including instant)
  if (isWithinCoverage) {
    console.log(`[Distance Filter] Within 20km - showing all ${whitelisted.length} whitelisted options`);
    return whitelisted;
  }
  
  // Outside 20km - filter out instant services, keep regular and cargo
  const filtered = whitelisted.filter(option => {
    const categories = getCourierCategories(option.courier);
    // Keep if courier supports regular or cargo (not just instant)
    return categories.includes("regular") || categories.includes("cargo");
  });
  
  console.log(`[Distance Filter] Outside 20km - removed ${whitelisted.length - filtered.length} instant-only options, showing ${filtered.length} regular/cargo options`);
  return filtered;
}

// BiteShip supported couriers (will be fetched dynamically from API)
// Updated to use whitelisted couriers only
export const BITESHIP_COURIERS = getWhitelistedCouriers();

export interface BiteShipRateRequest {
  origin_postal_code: string;
  destination_postal_code: string;
  weight: number; // in grams
  couriers?: string[];
  items?: any[];
  // Optional destination coordinates for distance-based filtering
  destination_lat?: number;
  destination_lng?: number;
}

export interface BiteShipRateResponse {
  success: boolean;
  data: BiteShipRateData[];
  meta?: any;
}

export interface BiteShipRateData {
  courier: string;
  courier_name: string;
  service: string;
  service_name: string;
  cost: number;
  price: number;
  etd: string;
  duration?: string;
  description?: string;
}

export interface BiteShipCity {
  id: string;
  name: string;
  province: string;
  postal_code: string;
  type: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  district?: string;
}

export interface BiteShipCityResponse {
  success: boolean;
  data: BiteShipCity[];
}

export interface BiteShipAreasResponse {
  success: boolean;
  data: BiteShipArea[];
}

export interface BiteShipArea {
  id: string;
  name: string;
  province: string;
  postal_code: string;
  type: string;
}

/**
 * Get shipping rates from BiteShip API with distance-based filtering and courier whitelist
 */
export async function getBiteShipRates(request: BiteShipRateRequest): Promise<BiteShipRateData[]> {
  try {
    // Use whitelisted couriers for the API request
    const whitelistedCouriers = getWhitelistedCouriers();
    
    const payload = {
      origin_postal_code: request.origin_postal_code,
      destination_postal_code: request.destination_postal_code,
      couriers: request.couriers?.join(",") || whitelistedCouriers.join(","),
      items: [
        {
          name: "Paket Belanja",
          description: "Barang Botamp",
          value: 50000, // Minimal value for insurance
          weight: request.weight > 0 ? request.weight : 1000,
          quantity: 1,
          length: 10,
          width: 10,
          height: 10
        }
      ]
    };

    console.log("SENDING TO BITESHIP:", JSON.stringify(payload));

    const response = await fetch(`${BITESHIP_CONFIG.baseUrl}/rates/couriers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BITESHIP_CONFIG.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log("BITESHIP RAW RESPONSE:", response.status, responseText);

    if (!response.ok) {
      throw new Error(`BiteShip API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);
    // BiteShip returns pricing in data.pricing array
    const rawRates = data.pricing || data.data || [];
    
    // Apply distance-based filtering if destination coordinates are provided
    if (request.destination_lat && request.destination_lng) {
      const shippingOptions = convertBiteShipRates(rawRates);
      const filteredOptions = filterShippingOptionsByDistance(
        shippingOptions,
        request.destination_lat,
        request.destination_lng
      );
      // Convert back to raw format for consistency (matching BiteShipRateData interface)
      return filteredOptions.map(opt => ({
        courier: opt.courier,
        courier_name: opt.name,
        service: opt.service || "",
        service_name: opt.service_name || "",
        cost: opt.cost,
        price: opt.cost,
        etd: opt.estimated,
        duration: opt.estimated,
        description: opt.service_type,
      }));
    }
    
    return rawRates;
  } catch (error) {
    console.error("BiteShip getRates error:", error);
    throw error;
  }
}

/**
 * Search areas from BiteShip Maps API (for autocomplete)
 * Uses the correct Maps API endpoint: /v1/maps/areas
 */
export async function searchBiteShipCities(query: string, limit: number = 20): Promise<BiteShipCity[]> {
  try {
    const response = await fetch(
      `${BITESHIP_CONFIG.baseUrl}/maps/areas?countries=ID&input=${encodeURIComponent(query)}&type=single`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${BITESHIP_CONFIG.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`BiteShip Maps API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.areas) {
      return [];
    }

    // Convert Maps API response to our internal BiteShipCity format
    return data.areas.map((area: any) => ({
      id: area.id,
      name: area.name,
      province: area.administrative_division_level_1_name,
      city: area.administrative_division_level_2_name,
      district: area.administrative_division_level_3_name,
      postal_code: area.postal_code,
      type: area.administrative_division_level_3_type,
      // Maps API does not return coordinates; we'll get them from Rates API later
    })).slice(0, limit);
  } catch (error) {
    console.error("BiteShip searchCities error:", error);
    return [];
  }
}


/**
 * Get city by ID from BiteShip Maps API
 * Note: Maps API does not return coordinates; use geocodePostalCode for coordinates
 */
export async function getBiteShipCityById(cityId: string): Promise<BiteShipCity | null> {
  try {
    // Use Maps API to get area by ID (if supported)
    const response = await fetch(
      `${BITESHIP_CONFIG.baseUrl}/maps/areas?countries=ID&input=${encodeURIComponent(cityId)}&type=single`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${BITESHIP_CONFIG.apiKey}`,
        },
      }
    );

    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.success || !data.areas || data.areas.length === 0) return null;
    
    const area = data.areas[0];
    return {
      id: area.id,
      name: area.name,
      province: area.administrative_division_level_1_name,
      city: area.administrative_division_level_2_name,
      district: area.administrative_division_level_3_name,
      postal_code: area.postal_code,
      type: area.administrative_division_level_3_type,
    };
  } catch {
    return null;
  }
}

/**
 * Geocode postal code to coordinates using Nominatim (OpenStreetMap) - free, no API key needed
 * @param postalCode - 5-digit Indonesian postal code
 * @param districtName - Optional district name for better accuracy
 * @returns Coordinates or null if not found
 */
export async function geocodePostalCode(
  postalCode: string,
  districtName?: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const query = districtName 
      ? `${districtName}, Indonesia`
      : `postcode:${postalCode}, Indonesia`;
    
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Botamp.id/1.0",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }
    
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Get all areas/cities from BiteShip (paginated)
 */
export async function getBiteShipAreas(page: number = 1, perPage: number = 100): Promise<BiteShipArea[]> {
  try {
    const response = await fetch(`${BITESHIP_CONFIG.baseUrl}/areas?page=${page}&per_page=${perPage}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BITESHIP_CONFIG.apiKey}`,
      },
    });

    if (!response.ok) return [];
    
    const data: BiteShipAreasResponse = await response.json();
    return data.success ? data.data : [];
  } catch {
    return [];
  }
}

/**
 * Convert BiteShip rate data to internal ShippingOption format
 */
export interface ShippingOption {
  courier: string;
  name: string;
  cost: number;
  estimated: string;
  service?: string;
  service_name?: string;
  service_type?: "instant" | "reguler";
}

export function convertBiteShipRates(rates: any[]): ShippingOption[] {
  return rates.map(rate => {
    const courier = rate.courier_code || rate.courier || rate.company;
    const courierName = rate.courier_name || rate.company_name || courier?.toUpperCase();
    const service = rate.courier_service_code || rate.type || rate.service;
    const serviceName = rate.courier_service_name || rate.service_name || service;
    const cost = rate.price || rate.cost || rate.shipping_fee || 0;
    const estimated = rate.duration || rate.etd || rate.estimated_delivery || "1-3 hari";
    
    const serviceType = rate.service_type?.toLowerCase().includes("same") || 
                       rate.service_type?.toLowerCase().includes("instant") ||
                       serviceName?.toLowerCase().includes("same") ||
                       serviceName?.toLowerCase().includes("instant") ||
                       estimated.toLowerCase().includes("same") ? "instant" : "reguler";

    return {
      courier: courier,
      name: courierName,
      cost: cost,
      estimated: estimated,
      service: service,
      service_name: serviceName,
      service_type: serviceType,
    };
  });
}

/**
 * Get origin postal code for the store (Cibinong, Bogor)
 */
export const STORE_ORIGIN_POSTAL_CODE = "16914";

export interface BiteShipShipmentRequest {
  courier: string;
  service: string;
  items: Array<{
    name: string;
    weight: number; // grams
    qty: number;
  }>;
  origin: {
    name: string;
    phone: string;
    address: string;
    postal_code: string;
  };
  destination: {
    name: string;
    phone: string;
    address: string;
    postal_code: string;
  };
  weight: number; // total weight in grams
}

export interface BiteShipShipmentResponse {
  success: boolean;
  data?: {
    waybill_number: string;
    courier_company: string;
    status: string;
  };
  message?: string;
}

/**
 * Valid courier_type mapping for Biteship Orders API
 * Some couriers have specific service codes that differ from the generic "reg"
 */
const VALID_COURIER_TYPES: Record<string, string> = {
  jnt: "ez",
  jne: "reg",
  anteraja: "reg",
};

function resolveCourierType(courier: string, requested?: string): string {
  if (requested && VALID_COURIER_TYPES[requested]) return VALID_COURIER_TYPES[requested];
  return VALID_COURIER_TYPES[courier] || requested || "reg";
}

/**
 * Create shipment via Biteship API and return waybill number
 * Called after Midtrans payment is confirmed
 */
export async function createBiteShipShipment(
  request: BiteShipShipmentRequest
): Promise<BiteShipShipmentResponse> {
  try {
    const courierType = resolveCourierType(request.courier, request.service);
    const payload = {
      origin_contact_name: request.origin.name,
      origin_contact_phone: request.origin.phone,
      origin_address: request.origin.address,
      origin_postal_code: parseInt(request.origin.postal_code, 10),
      destination_contact_name: request.destination.name,
      destination_contact_phone: request.destination.phone,
      destination_address: request.destination.address,
      destination_postal_code: parseInt(request.destination.postal_code, 10),
      courier_company: request.courier,
      courier_type: courierType,
      delivery_type: "now",
      items: request.items.map((item) => ({
        name: item.name,
        value: item.weight,
        quantity: item.qty,
        weight: item.weight,
        length: 20,
        width: 10,
        height: 5,
      })),
      weight: request.weight,
    };

    console.log("[BiteShip] Creating order:", JSON.stringify(payload));

    const response = await fetch(`${BITESHIP_CONFIG.baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BITESHIP_CONFIG.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log("[BiteShip] Response:", response.status, responseText);

    if (!response.ok) {
      throw new Error(`BiteShip API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);
        // Biteship Orders API returns: courier.waybill_id, courier.company
        const waybillNumber = data?.courier?.waybill_id || data?.data?.waybill_number || "";
        const courierCode = data?.courier?.company || data?.data?.courier_company || request.courier;
        const status = data?.status || data?.data?.status || "created";

        return {
          success: true,
          data: { waybill_number: waybillNumber, courier_company: courierCode, status },
        };
  } catch (error) {
    console.error("[BiteShip] createShipment error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}