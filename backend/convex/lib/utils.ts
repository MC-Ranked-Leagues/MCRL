import type { z } from "zod";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

type JsonRecord = Record<string, JsonValue | undefined>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function jsonError(
  message: string,
  status: number,
  details?: JsonRecord
): Response {
  console.error(`[HTTP ${status}] ${message}`, details ?? {});
  return jsonResponse({ error: message, status, ...details }, status);
}

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.generateKey(
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const [aHmac, bHmac] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b)),
  ]);
  const aBytes = new Uint8Array(aHmac);
  const bBytes = new Uint8Array(bHmac);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i]! ^ bBytes[i]!;
  }
  return diff === 0;
}

export async function validateApiKey(
  request: Request,
  envVar: "READER_API_KEY" | "WRITER_API_KEY"
): Promise<Response | null> {
  const providedKey = request.headers.get("x-api-key");
  const expectedKey = process.env[envVar];

  if (!expectedKey) {
    console.error(`[Config] ${envVar} environment variable is not set`);
    return jsonError("Server misconfiguration.", 500);
  }

  if (!providedKey) return jsonError("Unauthorized", 401);

  const isValid = await timingSafeEqual(providedKey, expectedKey);
  if (!isValid) return jsonError("Unauthorized", 401);

  return null;
}

export function extractQueryParams<T>(
  request: Request,
  schema: z.ZodType<T>
): { data: T } | { errorResponse: Response } {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    console.error("[HTTP] Query param validation failed", parsed.error.issues);
    return {
      errorResponse: jsonError("Invalid query parameters.", 400, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      }),
    };
  }
  return { data: parsed.data };
}
