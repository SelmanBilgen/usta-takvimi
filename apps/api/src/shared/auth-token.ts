import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

export interface AccessIdentity {
  role: "admin" | "customer" | "worker";
  subject: string;
  clientId?: number;
  workerId?: number;
  expiresAt: number;
}

function signingSecret() {
  return process.env.APP_TOKEN_SECRET ?? process.env.ADMIN_PASSWORD ?? "local-development-token-secret";
}

function signature(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createAccessToken(identity: Omit<AccessIdentity, "expiresAt">) {
  const payload = Buffer.from(JSON.stringify({ ...identity, expiresAt: Date.now() + 30 * 86400000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyAccessToken(token: string): AccessIdentity | null {
  const [payload, receivedSignature, extra] = token.split(".");
  if (!payload || !receivedSignature || extra) return null;

  const expected = Buffer.from(signature(payload));
  const received = Buffer.from(receivedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const identity = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AccessIdentity;
    if (!identity.subject || !["admin", "customer", "worker"].includes(identity.role) || identity.expiresAt <= Date.now()) return null;
    return identity;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      return resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

export function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, storedKey] = storedHash.split(":");
  if (!salt || !storedKey) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      const expected = Buffer.from(storedKey, "hex");
      resolve(expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey));
    });
  });
}