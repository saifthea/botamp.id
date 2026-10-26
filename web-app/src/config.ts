// Client-safe config (only non-sensitive data)
export const config = {
  brandName: "Botamp.id",
  whatsappNumber: "6285695316096",
  primaryColor: "#16a34a",
  rekening: {
    bank: "BSI",
    nama: "Agnes",
    nomor: "6764530"
  }
};

// Store coordinates for distance-based shipping validation
export const STORE_COORDINATES = {
  latitude: -6.4680334,
  longitude: 106.829002,
  // Cibinong, Bogor - Botamp.id warehouse
  originPostalCode: "16914",
};

// Maximum distance (in km) for instant/same-day courier services
export const MAX_INSTANT_DISTANCE_KM = 20;

// Server-only config (sensitive data - only import in server-side code / API routes)
export const serverConfig = {
  biteshipApiKey: process.env.BITESHIP_API_KEY || "biteship_test.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoia2V5IHRlc3QgYml0ZXNoaXAiLCJ1c2VySWQiOiI2YWI5ZTE3Y2U4ZTNjOTk2YjY3YTc3M2QiLCJpYXQiOjE3OTA1NjczNjF9.eg_mKiqmCmPL06jV3A0oX7YKz35AggpqrhFM6S1CY80",
};
