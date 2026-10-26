// Simple in-memory rate limiter for admin endpoints
// In production, use Redis or similar

import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60 * 1000 // 1 minute
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // First request or window expired
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
}

export function getClientIp(req: Request): string {
  // Try to get real IP from headers (for reverse proxy)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

export function rateLimitMiddleware(
  req: Request,
  maxRequests: number = 10,
  windowMs: number = 60 * 1000
): NextResponse | null {
  const ip = getClientIp(req);
  const result = checkRateLimit(`admin:${ip}`, maxRequests, windowMs);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          "X-RateLimit-Limit": maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000).toString(),
        },
      }
    );
  }

  return null;
}

// Helper untuk tambahkan rate limit headers ke response
export function addRateLimitHeaders(
  res: NextResponse,
  result: { remaining: number; resetTime: number; allowed: boolean }
): NextResponse {
  res.headers.set("X-RateLimit-Limit", "10");
  res.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  res.headers.set("X-RateLimit-Reset", Math.ceil(result.resetTime / 1000).toString());
  return res;
}