// Accepts "https://api.example.com", "https://api.example.com/" or the full ".../api/v1" form.
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "") + "/api/v1";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authToken = typeof window === "undefined"
    ? null
    : path.startsWith("/admin")
      ? localStorage.getItem("ustatakvimi_admin_token")
      : path.startsWith("/worker")
        ? localStorage.getItem("ustatakvimi_worker_token")
      : path.startsWith("/customer")
        ? localStorage.getItem("ustatakvimi_customer_token")
      : path.startsWith("/requests")
        ? localStorage.getItem("ustatakvimi_customer_token")
        : null;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(typeof FormData !== "undefined" && init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message ?? "Request failed");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body)
    }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body)
    }),
  upload: <T>(path: string, body: FormData) =>
    request<T>(path, {
      method: "PUT",
      body
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" })
};
