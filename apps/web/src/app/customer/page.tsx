"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, LogOut, Star } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { api } from "../../lib/api";
import { formatDate, formatDateTime } from "../../lib/date-format";

interface WorkReport {
  assignmentId: number;
  date: string;
  workerName: string;
  status: "IN_PROGRESS" | "COMPLETED";
  workDescription: string;
  updatedAt: string | null;
}
interface Review { rating: number; comment: string | null; createdAt: string }
interface CustomerRequest {
  id: number;
  expertiseName: string;
  startDate: string;
  endDate: string;
  status: string;
  description: string | null;
  estimatedWorkerCount: number;
  assignments: WorkReport[];
  review: Review | null;
}
interface RequestsResponse { requests: CustomerRequest[] }
interface ReviewDraft { rating: number; comment: string }

const statusLabels: Record<string, string> = {
  PENDING: "Bekliyor",
  ASSIGNED: "Usta atandı",
  COMPLETED: "Tamamlandı",
  CANCELED: "İptal edildi"
};

export default function CustomerPage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("Müşteri");
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [drafts, setDrafts] = useState<Record<number, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    try {
      const response = await api.get<RequestsResponse>("/customer/requests");
      setRequests(response.requests ?? []);
      setDrafts((current) => Object.fromEntries((response.requests ?? []).map((request) => [request.id, current[request.id] ?? { rating: 5, comment: "" }])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Talepler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!localStorage.getItem("ustatakvimi_customer_token")) {
      router.replace("/login");
      return;
    }
    setCustomerName(localStorage.getItem("ustatakvimi_account_name") ?? "Müşteri");
    void loadRequests();
  }, [router]);

  async function submitReview(event: FormEvent<HTMLFormElement>, request: CustomerRequest) {
    event.preventDefault();
    const draft = drafts[request.id];
    if (!draft) return;
    setSavingId(request.id);
    setError(null);
    setMessage(null);
    try {
      await api.post(`/customer/requests/${request.id}/review`, draft);
      setMessage("Değerlendirmeniz kaydedildi. Teşekkür ederiz.");
      await loadRequests();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Değerlendirme kaydedilemedi.");
    } finally {
      setSavingId(null);
    }
  }

  function logout() {
    localStorage.removeItem("ustatakvimi_customer_token");
    localStorage.removeItem("ustatakvimi_account_name");
    localStorage.removeItem("ustatakvimi_account_role");
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-[#f4f6f1] text-[#172c28]">
      <header className="border-b border-[#dce4dc] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3"><Link href="/request" aria-label="Geri" className="grid h-9 w-9 place-items-center border border-slate-200"><ArrowLeft size={17} /></Link><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b35e32]">Müşteri hesabı</p><h1 className="text-xl font-black">{customerName}</h1></div></div>
          <button onClick={logout} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><LogOut size={16} /> Çıkış</button>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-7 md:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black">Taleplerim</h2><p className="mt-1 text-sm text-slate-600">Usta notları, tamamlanma durumları ve değerlendirmeleriniz.</p></div><Link href="/request" className="bg-[#b35e32] px-4 py-2.5 text-sm font-bold text-white">Yeni talep</Link></div>
        {error && <p role="alert" className="mb-4 border-l-2 border-rose-600 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        {message && <p role="status" className="mb-4 border-l-2 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</p>}
        {loading ? <p className="py-8 text-sm text-slate-600">Talepler yükleniyor...</p> : requests.length === 0 ? <div className="border border-dashed border-[#c8d3c8] bg-white p-8 text-center"><ClipboardList className="mx-auto text-[#397568]" /><h3 className="mt-3 font-bold">Henüz talep oluşturmadınız</h3><Link href="/request" className="mt-3 inline-block font-semibold text-emerald-900 underline">Talep oluştur</Link></div> : <div className="space-y-4">
          {requests.map((request) => <article key={request.id} className="border border-[#dce4dc] bg-white p-5 sm:p-6">
            {(() => {
              const visibleReports = request.assignments.filter((assignment) => assignment.workDescription.trim().length > 0);
              const canReview = visibleReports.length > 0;
              return <>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b35e32]">Talep #{request.id}</p><h3 className="mt-1 text-xl font-black">{request.expertiseName}</h3><p className="mt-1 text-sm text-slate-600">{formatDate(request.startDate)} – {formatDate(request.endDate)} · {request.estimatedWorkerCount} usta</p></div><span className="bg-[#e7ece5] px-3 py-1 text-xs font-bold">{statusLabels[request.status] ?? request.status}</span></div>
            {request.description && <p className="mt-4 border-l-2 border-slate-300 pl-3 text-sm leading-6 text-slate-600">{request.description}</p>}
            {visibleReports.length > 0 && <section className="mt-5 border-t border-[#e5e9e3] pt-4"><h4 className="font-bold">Yapılan işlemler</h4><div className="mt-3 space-y-2">{visibleReports.map((report) => <article key={report.assignmentId} className="bg-[#f7f8f5] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{formatDate(report.date)} · {report.workerName}</strong><span className={`text-xs font-bold ${report.status === "COMPLETED" ? "text-emerald-800" : "text-amber-800"}`}>{report.status === "COMPLETED" ? "Tamamlandı" : "Devam ediyor"}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.workDescription}</p>{report.updatedAt && <p className="mt-1 text-xs text-slate-500">Son güncelleme: {formatDateTime(report.updatedAt)}</p>}</article>)}</div></section>}
            {request.review ? <div className="mt-5 border-t border-[#e5e9e3] pt-4"><h4 className="font-bold">Değerlendirmeniz</h4><p className="mt-2 flex items-center gap-1 text-amber-600">{Array.from({ length: request.review.rating }).map((_, index) => <Star key={index} size={17} fill="currentColor" />)}<span className="ml-2 text-sm font-bold text-slate-700">{request.review.rating}/5</span></p>{request.review.comment && <p className="mt-2 text-sm text-slate-700">{request.review.comment}</p>}</div> : canReview ? <form onSubmit={(event) => submitReview(event, request)} className="mt-5 border-t border-[#e5e9e3] pt-4"><h4 className="font-bold">İşlem başladı. Değerlendirmeniz</h4><label className="mt-3 block text-sm font-semibold">Puan<select value={drafts[request.id]?.rating ?? 5} onChange={(event) => setDrafts((current) => ({ ...current, [request.id]: { ...(current[request.id] ?? { comment: "" }), rating: Number(event.target.value) } }))} className="form-control mt-1 max-w-40">{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label><label className="mt-3 block text-sm font-semibold">Yorum<textarea rows={3} maxLength={1000} value={drafts[request.id]?.comment ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [request.id]: { ...(current[request.id] ?? { rating: 5 }), comment: event.target.value } }))} className="form-control mt-1" placeholder="Hizmet deneyiminizi paylaşın" /></label><button disabled={savingId === request.id} className="mt-3 bg-[#173f37] px-4 py-3 text-sm font-bold text-white">{savingId === request.id ? "Kaydediliyor..." : "Değerlendirmeyi gönder"}</button></form> : null}
              </>;
            })()}
          </article>)}
        </div>}
+      </div>
+    </main>
  );
}
