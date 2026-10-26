import { NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimitMiddleware, getClientIp } from "@/lib/rate-limit";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, serverTimestamp, Timestamp } from "@/lib/mongo"

const PASSWORD = process.env.ADMIN_PASSWORD || "4321";
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("⚠️  JWT_SECRET tidak ditemukan di environment variables!");
}

async function getJWTSecret(): Promise<string> {
  if (JWT_SECRET) return JWT_SECRET;
  const ref = doc(db, "config", "admin_session");
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data()?.jwt_secret) {
    return snap.data().jwt_secret;
  }
  const fallback = crypto.randomFillSync(crypto.randomBytes(32)).toString('hex');
  await setDoc(ref, { jwt_secret: fallback }, { merge: true });
  return fallback;
}

function createJWT(secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyJWT(token: string, secret: string): boolean {
  try {
    const [header, payload, signature] = token.split('.');
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest('base64url');
    if (signature !== expected) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rateLimitResponse = rateLimitMiddleware(req, 5, 60 * 1000);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = await req.json();
  if (body.password !== PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const secret = await getJWTSecret();
  const token = createJWT(secret);
  return NextResponse.json({ ok: true, token });
}

export async function isValidToken(token: string): Promise<boolean> {
  const secret = await getJWTSecret();
  const isValid = verifyJWT(token, secret);
  console.log("[DEBUG isValidToken]", {
    hasSecret: !!secret,
    secretSource: JWT_SECRET ? "env" : "firestore/fallback",
    tokenPrefix: token?.substring(0, 20),
    isValid,
  });
  return isValid;
}

// Debug endpoint - hanya untuk development
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("check") === "token") {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace("AdminSession ", "");
    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }
    const isValid = await isValidToken(token);
    return NextResponse.json({
      tokenPrefix: token.substring(0, 30),
      isValid,
      timestamp: new Date().toISOString(),
    });
  }
  return NextResponse.json({ error: "Use ?check=token" }, { status: 400 });
}

export function revokeToken(_token: string): void {}