"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquareText, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../../../lib/api";
import { formatDate, formatDateTime } from "../../../lib/date-format";

interface ActivityRequest { requestId: number; clientName: string; expertiseName: string; status: string; createdAt: string }
interface WorkUpdate { requestId: number; clientName: string; date: string; workerName: string; status: "IN_PROGRESS" | "COMPLETED"; workDescription: string; updatedAt: string }
interface Review { requestId: number; clientName: string; rating: number; comment: string | null; createdAt: string }
interface ActivityResponse { requests: ActivityRequest[]; workUpdates: WorkUpdate[]; reviews: Review[] }

const requestStatuses: Record<string, string> = { PENDING: "Bekliyor", ASSIGNED: "Atandı", COMPLETED: "Tamamlandı", CANCELED: "İptal" };

export default function AdminActivityPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ActivityRequest[]>([]);
  const [workUpdates, setWorkUpdates] = useState<WorkUpdate[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("ustatakvimi_admin_token")) {
      router.replace("/login");
      return;
    }
    api.get<ActivityResponse>("/admin/manage/activity")
      .then((response) => {
        const newestFirst = [...(response.requests ?? [])].sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt) || right.requestId - left.requestId
        );
        setRequests(newestFirst);
        setWorkUpdates(response.workUpdates ?? []);
        setReviews(response.reviews ?? []);
        setSelectedRequestId(newestFirst[0]?.requestId ?? null);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "İş kayıtları yüklenemedi."))
      .finally(() => setLoading(false));
  }, [router]);

  const selectedRequest = requests.find((request) => request.requestId === selectedRequestId) ?? null;
  const selectedWorkUpdates = useMemo(() => workUpdates
    .filter((update) => update.requestId === selectedRequestId)
    .sort((left, right) => right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt)), [selectedRequestId, workUpdates]);
  const selectedReview = reviews.find((review) => review.requestId === selectedRequestId) ?? null;

  return (
    <main className="min-h-screen bg-[#f4f6f1] text-[#172c28]">
      <header className="border-b border-[#dce4dc] bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 md:px-8">
          <Link href="/admin" aria-label="Yönetim paneline dön" className="grid h-9 w-9 place-items-center border border-slate-200"><ArrowLeft size={17} /></Link>
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b35e32]">Yönetim</p><h1 className="text-xl font-black">İş kayıtları ve değerlendirmeler</h1></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl items-start gap-5 px-4 py-7 md:px-8 xl:grid-cols-[.85fr,1.15fr]">
        {error && <p role="alert" className="border-l-2 border-rose-600 bg-rose-50 px-4 py-3 text-sm text-rose-800 xl:col-span-2">{error}</p>}
        <section>
          <div className="mb-3"><h2 className="text-lg font-black">Talepler</h2><p className="text-sm text-slate-600">En yeni talep en üstte listelenir.</p></div>
          {loading ? <p className="py-6 text-sm text-slate-600">Talepler yükleniyor...</p> : requests.length === 0 ? <p className="border border-dashed border-[#c8d3c8] bg-white p-5 text-sm text-slate-600">Henüz talep yok.</p> : <div className="space-y-2">
            {requests.map((request) => <button key={request.requestId} onClick={() => setSelectedRequestId(request.requestId)} aria-pressed={request.requestId === selectedRequestId} className={`w-full border p-4 text-left transition ${request.requestId === selectedRequestId ? "border-[#b35e32] bg-[#fbf3ed]" : "border-[#dce4dc] bg-white hover:border-[#a7b7aa]"}`}>
              <span className="grid grid-cols-[auto,1fr] items-center gap-x-3 gap-y-1"><strong className="row-span-2 text-lg">#{request.requestId}</strong><span className="truncate font-bold">{request.clientName}</span><span className="truncate text-sm text-slate-600">{request.expertiseName}</span></span>
              <span className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-2 text-xs"><span className="text-slate-500">{request.createdAt ? formatDateTime(request.createdAt) : "Tarih belirtilmemiş"}</span><span className="font-bold text-[#8e4929]">{requestStatuses[request.status] ?? request.status}</span></span>
            </button>)}
          </div>}
        </section>
        <section className="min-h-64 border border-[#dce4dc] bg-white p-5 sm:p-6">
          {selectedRequest ? <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e5e9e3] pb-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b35e32]">Talep #{selectedRequest.requestId}</p><h2 className="mt-1 text-2xl font-black">{selectedRequest.clientName}</h2><p className="mt-1 text-sm text-slate-600">{selectedRequest.expertiseName} · {requestStatuses[selectedRequest.status] ?? selectedRequest.status}</p></div></div>
            <section className="mt-5"><div className="flex items-center gap-2"><MessageSquareText size={18} className="text-[#397568]" /><h3 className="font-bold">Usta açıklamaları</h3></div>
              {selectedWorkUpdates.length ? <div className="mt-3 space-y-3">{selectedWorkUpdates.map((item) => <article key={`${item.date}-${item.workerName}`} className="bg-[#f7f8f5] p-4"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{formatDate(item.date)} · {item.workerName}</strong><span className={`text-xs font-bold ${item.status === "COMPLETED" ? "text-emerald-800" : "text-amber-800"}`}>{item.status === "COMPLETED" ? "Tamamlandı" : "Devam ediyor"}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.workDescription}</p><p className="mt-2 text-xs text-slate-500">Güncelleme: {formatDateTime(item.updatedAt)}</p></article>)}</div> : <p className="mt-2 text-sm text-slate-500">Bu talep için henüz usta açıklaması yok.</p>}
            </section>
            <section className="mt-6 border-t border-[#e5e9e3] pt-5"><div className="flex items-center gap-2"><Star size={18} className="text-amber-600" /><h3 className="font-bold">Müşteri değerlendirmesi</h3></div>
              {selectedReview ? <div className="mt-3 bg-[#f7f8f5] p-4"><p className="flex items-center gap-1 text-amber-600">{Array.from({ length: selectedReview.rating }).map((_, index) => <Star key={index} size={17} fill="currentColor" />)}<span className="ml-1 text-sm font-bold text-slate-700">{selectedReview.rating}/5</span></p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedReview.comment || "Yorum eklenmemiş."}</p><p className="mt-2 text-xs text-slate-500">{formatDateTime(selectedReview.createdAt)}</p></div> : <p className="mt-2 text-sm text-slate-500">Bu talep için henüz müşteri değerlendirmesi yok.</p>}
            </section>
          </> : <p className="py-10 text-center text-sm text-slate-500">Detayları görmek için bir talep seçin.</p>}
        </section>
      </div>
    </main>
  );
}
