import { dbPool } from "./db/pool.js";

export interface FallbackClient {
  id: number;
  company_or_name: string;
  contact_info: { phone?: string; email?: string } | null;
}

export interface FallbackAccount {
  id: number;
  client_id: number;
  email: string;
  password_hash: string;
}

export interface FallbackWorkerAccount {
  id: number;
  worker_id: number;
  email: string;
  password_hash: string;
}

export interface FallbackWorkUpdate {
  assignment_id: number;
  worker_id: number;
  status: "IN_PROGRESS" | "COMPLETED";
  work_description: string;
  updated_at: string;
  completed_at: string | null;
}

export interface FallbackReview {
  request_id: number;
  client_id: number;
  rating: number;
  comment: string;
  created_at: string;
}

export interface FallbackWorker {
  id: number;
  name: string;
  expertise_id: number;
  daily_status: "ACTIVE" | "INACTIVE";
  phone?: string | null;
  email?: string | null;
  bio?: string | null;
  image_url?: string | null;
}

export interface FallbackExpertise {
  id: number;
  name: string;
  description: string;
  image_url: string;
}

export interface FallbackRequest {
  id: number;
  client_id: number;
  expertise_id: number;
  start_date: string;
  end_date: string;
  status: "PENDING" | "ASSIGNED" | "COMPLETED" | "CANCELED";
  description?: string | null;
  estimated_worker_count: number;
  created_at?: string;
}

export interface FallbackAssignment {
  id: number;
  request_id: number;
  worker_id: number;
  assignment_date: string;
}

export const fallbackState = {
  clients: [
    { id: 1, company_or_name: "Akar Yapi", contact_info: { phone: "+90 555 111 2233", email: "info@akaryapi.com" } },
    { id: 2, company_or_name: "Deniz Insaat", contact_info: { phone: "+90 555 444 5566", email: "iletisim@denizinsaat.com" } },
    { id: 3, company_or_name: "Gulbahar Proje", contact_info: { phone: "+90 555 777 8899", email: "yapi@gulbaharproje.com" } }
  ] as FallbackClient[],
  accounts: [] as FallbackAccount[],
  workerAccounts: [] as FallbackWorkerAccount[],
  workers: [
    { id: 1, name: "Murat K.", expertise_id: 1, daily_status: "ACTIVE" },
    { id: 2, name: "Ali T.", expertise_id: 1, daily_status: "ACTIVE" },
    { id: 3, name: "Caner Y.", expertise_id: 2, daily_status: "ACTIVE" },
    { id: 4, name: "Emre S.", expertise_id: 2, daily_status: "INACTIVE" },
    { id: 5, name: "Baran D.", expertise_id: 3, daily_status: "ACTIVE" },
    { id: 6, name: "Kubilay C.", expertise_id: 3, daily_status: "ACTIVE" }
  ] as FallbackWorker[],
  expertises: [
    { id: 1, name: "Boyacı", description: "İç ve dış cephe boya uygulamaları.", image_url: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=900&q=85" },
    { id: 2, name: "Tesisatçı", description: "Su tesisatı, bakım ve yenileme işleri.", image_url: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=900&q=85" },
    { id: 3, name: "Elektrikçi", description: "Elektrik tesisatı ve güvenli montaj işleri.", image_url: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=900&q=85" }
  ] as FallbackExpertise[],
  requests: [
    { id: 1, client_id: 1, expertise_id: 3, start_date: "2026-10-15", end_date: "2026-10-18", status: "PENDING", description: "Konut projesinde elektrik kurulumu ihtiyacı.", estimated_worker_count: 2 },
    { id: 2, client_id: 2, expertise_id: 2, start_date: "2026-10-16", end_date: "2026-10-17", status: "PENDING", description: "Su tesisatı bakım ve tadilat çalışması.", estimated_worker_count: 1 },
    { id: 3, client_id: 3, expertise_id: 1, start_date: "2026-10-20", end_date: "2026-10-22", status: "PENDING", description: "Fasat duvar ve iç cephe boyama", estimated_worker_count: 3 }
  ] as FallbackRequest[],
  assignments: [
    { id: 1, request_id: 1, worker_id: 5, assignment_date: "2026-10-15" },
    { id: 2, request_id: 1, worker_id: 6, assignment_date: "2026-10-17" }
  ] as FallbackAssignment[],
  workUpdates: [] as FallbackWorkUpdate[],
  reviews: [] as FallbackReview[]
  ,siteImages: {} as Record<string, string>
};

export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await dbPool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export function createDateSpan(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const results: string[] = [];

  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + 86400000)) {
    results.push(cursor.toISOString().slice(0, 10));
  }

  return results;
}

export function getNextRequestId(): number {
  return Math.max(0, ...fallbackState.requests.map((request) => request.id)) + 1;
}

export function getNextAssignmentId(): number {
  return Math.max(0, ...fallbackState.assignments.map((assignment) => assignment.id)) + 1;
}
