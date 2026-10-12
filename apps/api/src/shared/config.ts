export const isProduction = process.env.NODE_ENV === "production";

const requiredInProduction = [
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "ADMIN_PASSWORD",
  "APP_TOKEN_SECRET",
  "CORS_ORIGIN",
  "PUBLIC_API_URL"
];

export function assertProductionConfig() {
  if (!isProduction) return;

  const missing = requiredInProduction.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function allowedCorsOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}
