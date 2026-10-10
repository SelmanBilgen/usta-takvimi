"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, List, Plus, Save, Trash2, Users, Wrench, X } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import trLocale from "@fullcalendar/core/locales/tr";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { DateField } from "../../components/date-field";
import { ProfilePhotoField } from "../../components/profile-photo-field";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/date-format";

interface Expertise { id: number; name: string; description?: string | null; imageUrl?: string | null; image_url?: string }
interface Worker { id: number; workerId?: number; name: string; expertiseId: number; expertiseName?: string; status?: "ACTIVE" | "INACTIVE"; daily_status?: "ACTIVE" | "INACTIVE"; phone?: string | null; email?: string | null; bio?: string | null; imageUrl?: string | null }
interface RequestItem { id: number; clientName: string; expertiseName: string; expertiseId?: number; startDate: string; endDate: string; estimatedWorkerCount: number; status: string; description?: string | null }
interface ScheduleItem { id: number; requestId: number; date: string; workerId: number; workerName: string; expertiseId: number; expertiseName: string; clientName: string; status: string }
interface AvailableWorker { workerId: number; name: string; expertiseId: number; fullyAvailable: boolean; conflictingDates: string[] }
interface AvailabilityForRequest { workers: AvailableWorker[]; assignmentsByDate: Record<string, Array<{ workerId: number; workerName: string }>> }
type AdminTab = "schedule" | "requests" | "workers" | "expertises";
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

interface WorkerForm { name: string; expertiseId: number; status: "ACTIVE" | "INACTIVE"; phone: string; email: string; bio: string; imageUrl: string }
const blankWorker: WorkerForm = { name: "", expertiseId: 1, status: "ACTIVE", phone: "", email: "", bio: "", imageUrl: "" };
const blankExpertise = { name: "", description: "", imageUrl: "" };
const defaultWorkerImage = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=85";
const defaultExpertiseImage = "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=85";

function requestDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  const end = new Date(`${endDate}T00:00:00.000Z`);
  for (let date = new Date(`${startDate}T00:00:00.000Z`); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("schedule");
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [expertises, setExpertises] = useState<Expertise[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [requestStartDate, setRequestStartDate] = useState("");
  const [requestEndDate, setRequestEndDate] = useState("");
  const [availableWorkers, setAvailableWorkers] = useState<AvailableWorker[]>([]);
  const [selectedWorkersByDate, setSelectedWorkersByDate] = useState<Record<string, number[]>>({});
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string | null>(null);
  const [workerForm, setWorkerForm] = useState(blankWorker);
  const [workerPhotoFile, setWorkerPhotoFile] = useState<File | null>(null);
  const [editingWorkerId, setEditingWorkerId] = useState<number | null>(null);
  const [expertiseForm, setExpertiseForm] = useState(blankExpertise);
  const [expertisePhotoFile, setExpertisePhotoFile] = useState<File | null>(null);
  const [editingExpertiseId, setEditingExpertiseId] = useState<number | null>(null);
  const [expertiseFilter, setExpertiseFilter] = useState("");
  const [workerFilter, setWorkerFilter] = useState("");
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [accountName, setAccountName] = useState("Yönetici");

  useEffect(() => {
    if (!localStorage.getItem("ustatakvimi_admin_token")) router.replace("/login");
    setAccountName(localStorage.getItem("ustatakvimi_account_name") ?? "Yönetici");
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    setRangeStart(dateKey(start));
    setRangeEnd(dateKey(end));
  }, [router]);

  async function loadWorkspace() {
    setLoading(true); setError(null);
    try {
      const [requestResponse, workerResponse, expertiseResponse] = await Promise.all([
        api.get<{ requests: RequestItem[] }>("/admin/requests"),
        api.get<{ workers: Worker[] }>("/admin/manage/workers"),
        api.get<{ expertises: Expertise[] }>("/expertises")
      ]);
      setRequests(requestResponse.requests ?? []);
      setWorkers(workerResponse.workers ?? []);
      setExpertises(expertiseResponse.expertises ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Yönetim verileri yüklenemedi.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadWorkspace(); }, []);

  useEffect(() => {
    setWorkerPhotoFile(null);
    setWorkerForm((current) => ({ ...current, imageUrl: "" }));
  }, [editingWorkerId]);
  useEffect(() => {
    setExpertisePhotoFile(null);
    setExpertiseForm((current) => ({ ...current, imageUrl: "" }));
  }, [editingExpertiseId]);

  useEffect(() => {
    if (!rangeStart || !rangeEnd) return;
    api.get<{ assignments: ScheduleItem[] }>(`/admin/manage/schedule?startDate=${rangeStart}&endDate=${rangeEnd}${expertiseFilter ? `&expertiseId=${expertiseFilter}` : ""}${workerFilter ? `&workerId=${workerFilter}` : ""}`)
      .then((response) => setSchedule(response.assignments ?? []))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Takvim yüklenemedi."));
  }, [rangeStart, rangeEnd, expertiseFilter, workerFilter]);

  useEffect(() => {
    if (!selectedRequest) { setAvailableWorkers([]); setSelectedWorkersByDate({}); return; }
    api.get<AvailabilityForRequest>(`/admin/requests/${selectedRequest.id}/available-workers`)
      .then((response) => {
        setAvailableWorkers(response.workers ?? []);
        setSelectedWorkersByDate(Object.fromEntries(Object.entries(response.assignmentsByDate ?? {}).map(([date, items]) => [date, items.map((item) => item.workerId)])));
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Usta listesi yüklenemedi."));
  }, [selectedRequest]);

  const filteredSchedule = useMemo(() => schedule, [schedule]);
  const scheduleEvents = useMemo(() => filteredSchedule.map((item) => ({
    title: `${item.workerName} · ${item.expertiseName} · ${item.clientName}`,
    date: item.date,
    backgroundColor: "#397568",
    borderColor: "#397568",
    extendedProps: { requestId: item.requestId }
  })), [filteredSchedule]);
  const selectedDayRequests = useMemo(() => {
    if (!selectedScheduleDate) return [];
    return Array.from(new Map(filteredSchedule.filter((item) => item.date === selectedScheduleDate).map((item) => [item.requestId, item])).values());
  }, [filteredSchedule, selectedScheduleDate]);

  async function refresh() { await loadWorkspace(); }
  async function uploadProfilePhoto(key: string, file: File) {
    const form = new FormData();
    form.append("image", file);
    const result = await api.upload<{ imageUrl: string }>(`/admin/manage/site-images/${key}`, form);
    return result.imageUrl;
  }
  async function submitWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null); setMessage(null);
    try {
      if (editingWorkerId) {
        const imageUrl = workerPhotoFile ? await uploadProfilePhoto(`worker-${editingWorkerId}`, workerPhotoFile) : workerForm.imageUrl;
        await api.put(`/admin/manage/workers/${editingWorkerId}`, { ...workerForm, imageUrl });
      } else {
        await api.post(`/admin/manage/workers`, workerForm);
      }
      setWorkerPhotoFile(null);
      setWorkerForm(blankWorker); setEditingWorkerId(null); setMessage("Usta profili kaydedildi."); await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Usta kaydedilemedi."); }
    finally { setSaving(false); }
  }
  async function submitExpertise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null); setMessage(null);
    try {
      if (editingExpertiseId) {
        const imageUrl = expertisePhotoFile ? await uploadProfilePhoto(`expertise-${editingExpertiseId}`, expertisePhotoFile) : expertiseForm.imageUrl;
        await api.put(`/admin/manage/expertises/${editingExpertiseId}`, { ...expertiseForm, imageUrl });
      }
      else await api.post(`/admin/manage/expertises`, expertiseForm);
      setExpertisePhotoFile(null);
      setExpertiseForm(blankExpertise); setEditingExpertiseId(null); setMessage("Uzmanlık alanı kaydedildi."); await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Uzmanlık alanı kaydedilemedi."); }
    finally { setSaving(false); }
  }
  async function saveRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedRequest) return;
    setSaving(true); setError(null); setMessage(null);
    const form = new FormData(event.currentTarget);
    const startDate = String(form.get("startDate") || "");
    const endDate = String(form.get("endDate") || "");
    if (!startDate || !endDate || endDate < startDate) {
      setError("Başlangıç ve bitiş tarihlerini gün ay yıl biçiminde kontrol edin.");
      setSaving(false);
      return;
    }
    try {
      const response = await api.put<{ assignmentsReset: boolean }>(`/admin/requests/${selectedRequest.id}`, {
        expertiseId: Number(form.get("expertiseId")),
        startDate,
        endDate,
        estimatedWorkerCount: Number(form.get("estimatedWorkerCount")),
        description: String(form.get("description") || "")
      });
      setMessage(response.assignmentsReset ? "Talep güncellendi. Tarih veya uzmanlık değiştiği için eski atamalar kaldırıldı." : "Talep güncellendi.");
      setSelectedRequest(null); setRequestStartDate(""); setRequestEndDate(""); await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Talep güncellenemedi."); }
    finally { setSaving(false); }
  }
  async function deleteRequest(request: RequestItem) {
    if (!window.confirm(`#${request.id} numaralı talep ve atamaları silinsin mi?`)) return;
    try { await api.delete(`/admin/requests/${request.id}`); setSelectedRequest(null); setMessage("Talep silindi."); await refresh(); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Talep silinemedi."); }
  }
  async function assignSelected() {
    if (!selectedRequest) return;
    try {
      const days = requestDates(selectedRequest.startDate, selectedRequest.endDate).map((date) => ({ date, workerIds: selectedWorkersByDate[date] ?? [] }));
      const result = await api.put<{ assignedWorkerCount: number; assignedDatesCount: number }>(`/admin/requests/${selectedRequest.id}/assignments`, { days });
      setMessage(`${result.assignedWorkerCount} farklı usta, ${result.assignedDatesCount} güne atandı.`); await refresh();
    } catch (assignError) { setError(assignError instanceof Error ? assignError.message : "Atama başarısız oldu."); }
  }
  function openScheduleRequest(requestId: number) {
    const request = requests.find((item) => item.id === requestId);
    if (request) { selectRequest(request); setTab("requests"); }
  }
  function selectRequest(request: RequestItem) {
    setSelectedRequest(request);
    setRequestStartDate(request.startDate);
    setRequestEndDate(request.endDate);
    setError(null);
    setMessage(null);
  }
  function logout() { localStorage.removeItem("ustatakvimi_admin_token"); localStorage.removeItem("ustatakvimi_account_name"); localStorage.removeItem("ustatakvimi_account_role"); router.push("/login"); }
  function changeTab(next: AdminTab) { setTab(next); setError(null); setMessage(null); }

  return (
    <main className="admin-layout min-h-screen bg-[#f4f6f1] text-[#172c28]">
      <header className="border-b border-[#dce4dc] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3"><Link href="/" aria-label="Geri" className="grid h-9 w-9 place-items-center border border-slate-200 text-slate-700 hover:bg-slate-50"><ArrowLeft size={17} /></Link><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b35e32]">Operasyon</p><h1 className="text-xl font-black">Yönetim paneli</h1></div></div>
          <div className="flex items-center gap-3"><Link href="/request" className="hidden items-center gap-2 border border-[#dce4dc] px-3 py-2 text-sm font-bold text-[#245c51] sm:inline-flex"><Plus size={15} /> Talep sayfası</Link><span className="max-w-36 truncate text-sm font-semibold">{accountName}</span><button onClick={logout} className="text-sm font-semibold text-slate-600 hover:text-slate-950">Çıkış</button></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/admin/worker-access" className="border border-[#dce4dc] bg-white px-3 py-2 text-sm font-bold text-[#245c51]">Usta giriş bilgileri</Link>
          <Link href="/admin/activity" className="border border-[#dce4dc] bg-white px-3 py-2 text-sm font-bold text-[#245c51]">İş raporları ve değerlendirmeler</Link>
        </div>
        <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-[#dce4dc]" aria-label="Yönetim bölümleri">
          {([ ["schedule", "Takvim", CalendarDays], ["requests", "Talepler", List], ["workers", "Ustalar", Users], ["expertises", "Uzmanlıklar", Wrench] ] as const).map(([key, label, Icon]) => <button key={key} onClick={() => changeTab(key)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${tab === key ? "border-[#b35e32] text-[#8e4929]" : "border-transparent text-slate-500 hover:text-slate-900"}`}><Icon size={16} />{label}</button>)}
        </nav>
        {error && <p role="alert" className="mb-4 border-l-2 border-rose-600 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        {message && <p role="status" className="mb-4 border-l-2 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</p>}
        {loading ? <p className="py-10 text-sm text-slate-600">Yönetim verileri yükleniyor...</p> : <>
          {tab === "schedule" && <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black">Atama takvimi</h2><p className="mt-1 text-sm text-slate-600">Usta veya iş türüne göre günlük işleri filtreleyin.</p></div><div className="flex border border-[#dce4dc] bg-white"><button onClick={() => setViewMode("calendar")} aria-label="Takvim görünümü" title="Takvim görünümü" className={`p-2.5 ${viewMode === "calendar" ? "bg-[#173f37] text-white" : "text-slate-600"}`}><CalendarDays size={18} /></button><button onClick={() => setViewMode("list")} aria-label="Liste görünümü" title="Liste görünümü" className={`p-2.5 ${viewMode === "list" ? "bg-[#173f37] text-white" : "text-slate-600"}`}><List size={18} /></button></div></div>
            <div className="mb-4 grid gap-3 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
              <DateField label="Başlangıç" value={rangeStart} onChange={setRangeStart} />
              <DateField label="Bitiş" value={rangeEnd} min={rangeStart} onChange={setRangeEnd} />
              <label className="text-xs font-bold text-slate-600">İş türü<select value={expertiseFilter} onChange={(event) => setExpertiseFilter(event.target.value)} className="form-control mt-1"><option value="">Tüm uzmanlıklar</option>{expertises.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-600">Usta<select value={workerFilter} onChange={(event) => setWorkerFilter(event.target.value)} className="form-control mt-1"><option value="">Tüm ustalar</option>{workers.map((item) => <option key={item.id ?? item.workerId} value={item.id ?? item.workerId}>{item.name}</option>)}</select></label>
            </div>
            {viewMode === "calendar" ? <div className="space-y-4 border border-[#dce4dc] bg-white p-3 sm:p-5">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                locale={trLocale}
                initialView="dayGridMonth"
                headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
                height="auto"
                events={scheduleEvents}
                dateClick={(info: DateClickArg) => setSelectedScheduleDate(info.dateStr)}
                eventClick={(info) => openScheduleRequest(Number(info.event.extendedProps.requestId))}
              />
              {selectedScheduleDate && <div className="border-t border-[#dce4dc] pt-4">
                <h3 className="font-bold">{formatDate(selectedScheduleDate)} tarihindeki işler</h3>
                {selectedDayRequests.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2">{selectedDayRequests.map((item) => <button key={item.requestId} onClick={() => openScheduleRequest(item.requestId)} className="border border-[#dce4dc] bg-[#f7f8f5] p-3 text-left hover:border-[#397568]"><span className="block font-bold">Talep #{item.requestId} · {item.clientName}</span><span className="mt-1 block text-sm text-slate-600">{item.expertiseName} · {item.workerName}</span></button>)}</div> : <p className="mt-2 text-sm text-slate-500">Bu tarihte atanmış talep bulunmuyor.</p>}
              </div>}
            </div> : <div className="overflow-x-auto border border-[#dce4dc] bg-white"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-[#dce4dc] bg-[#f7f8f5] text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Tarih</th><th className="px-4 py-3">Usta</th><th className="px-4 py-3">İş türü</th><th className="px-4 py-3">Müşteri / talep</th><th className="px-4 py-3">Durum</th></tr></thead><tbody>{filteredSchedule.map((item) => <tr key={item.id} onClick={() => openScheduleRequest(item.requestId)} className="cursor-pointer border-b border-slate-100 hover:bg-[#f7f8f5]"><td className="px-4 py-3 font-semibold">{formatDate(item.date)}</td><td className="px-4 py-3">{item.workerName}</td><td className="px-4 py-3">{item.expertiseName}</td><td className="px-4 py-3">{item.clientName} · #{item.requestId}</td><td className="px-4 py-3">{item.status}</td></tr>)}{filteredSchedule.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Seçilen filtrelerde atanmış iş yok.</td></tr>}</tbody></table></div>}
          </section>}

          {tab === "requests" && <section className="grid gap-5 xl:grid-cols-[.9fr,1.1fr]"><div><h2 className="text-2xl font-black">İş talepleri</h2><p className="mt-1 text-sm text-slate-600">Talep seçerek düzenleyin, silin veya usta atayın.</p><div className="mt-4 space-y-2">{requests.map((request) => <button key={request.id} onClick={() => selectRequest(request)} className={`w-full border p-4 text-left transition ${selectedRequest?.id === request.id ? "border-[#b35e32] bg-[#fbf3ed]" : "border-[#dce4dc] bg-white hover:border-[#a7b7aa]"}`}><div className="flex items-center justify-between gap-3"><strong>#{request.id} · {request.clientName}</strong><span className="text-xs font-bold uppercase text-[#8e4929]">{request.status}</span></div><p className="mt-1 text-sm text-slate-600">{request.expertiseName} · {formatDate(request.startDate)} – {formatDate(request.endDate)}</p><p className="mt-1 text-xs text-slate-500">Usta sayısı: {request.estimatedWorkerCount}</p></button>)}{requests.length === 0 && <p className="border border-[#dce4dc] bg-white p-5 text-sm text-slate-600">Henüz talep yok.</p>}</div></div>
            <div>{selectedRequest ? <div className="border border-[#dce4dc] bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase text-[#b35e32]">Talep #{selectedRequest.id}</p><h3 className="mt-1 text-xl font-black">{selectedRequest.clientName}</h3></div><button onClick={() => setSelectedRequest(null)} title="Kapat" aria-label="Kapat"><X size={18} /></button></div><form onSubmit={saveRequest} className="mt-4 grid gap-3 sm:grid-cols-2"><div className="border-l-2 border-[#b35e32] bg-[#fbf3ed] px-4 py-3 text-sm leading-6 text-slate-700 sm:col-span-2"><span className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-[#8e4929]">Müşteri açıklaması</span>“{selectedRequest.description?.trim() || "Müşteri açıklama eklememiş."}”</div><label className="text-sm font-semibold">Uzmanlık<select name="expertiseId" defaultValue={selectedRequest.expertiseId ?? expertises.find((item) => item.name === selectedRequest.expertiseName)?.id} className="form-control mt-1">{expertises.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-semibold">Usta sayısı<input name="estimatedWorkerCount" type="number" min={1} defaultValue={selectedRequest.estimatedWorkerCount} className="form-control mt-1" /></label><DateField label="Başlangıç" value={requestStartDate} name="startDate" onChange={setRequestStartDate} /><DateField label="Bitiş" value={requestEndDate} name="endDate" min={requestStartDate} onChange={setRequestEndDate} /><label className="text-sm font-semibold sm:col-span-2">Açıklamayı düzenle<textarea name="description" rows={3} defaultValue={selectedRequest.description ?? ""} className="form-control mt-1" /></label><button disabled={saving} className="inline-flex items-center justify-center gap-2 bg-[#173f37] px-4 py-3 font-bold text-white"><Save size={16} /> Kaydet</button><button type="button" onClick={() => deleteRequest(selectedRequest)} className="inline-flex items-center justify-center gap-2 border border-rose-200 px-4 py-3 font-bold text-rose-800"><Trash2 size={16} /> Talebi sil</button></form>
                {selectedRequest.status !== "CANCELED" && selectedRequest.status !== "COMPLETED" && <div className="mt-6 border-t border-[#e5e9e3] pt-4"><h4 className="font-bold">Günlük usta atamaları</h4><p className="mt-1 text-sm text-slate-600">Her gün için farklı usta seçebilir, mevcut atamaları değiştirebilirsiniz.</p><div className="mt-3 space-y-3">{requestDates(selectedRequest.startDate, selectedRequest.endDate).map((date, index) => <fieldset key={date} className="border border-[#dce4dc] p-3"><legend className="px-1 text-sm font-bold">Gün {index + 1} · {formatDate(date)}</legend><div className="grid gap-2 sm:grid-cols-2">{availableWorkers.map((worker) => { const checked = (selectedWorkersByDate[date] ?? []).includes(worker.workerId); return <label key={worker.workerId} className={`flex items-start gap-2 border p-2 text-sm ${worker.fullyAvailable || checked ? "cursor-pointer border-[#dce4dc]" : "border-rose-100 bg-rose-50/40 opacity-60"}`}><input type="checkbox" disabled={!worker.fullyAvailable && !checked} checked={checked} onChange={() => setSelectedWorkersByDate((current) => { const selected = current[date] ?? []; return { ...current, [date]: selected.includes(worker.workerId) ? selected.filter((id) => id !== worker.workerId) : [...selected, worker.workerId] }; })} className="mt-1 accent-[#397568]" /><span className="min-w-0"><strong>{worker.name}</strong><span className="block text-xs text-slate-600">{worker.fullyAvailable ? "Müsait" : `Başka işte: ${worker.conflictingDates.join(", ")}`}</span></span></label>; })}</div></fieldset>)}</div><button disabled={saving} onClick={assignSelected} className="mt-3 w-full bg-[#b35e32] px-4 py-3 font-bold text-white disabled:opacity-50">{saving ? "Kaydediliyor..." : "Günlük atamaları kaydet"}</button></div>}
              </div> : <p className="border border-dashed border-[#c8d3c8] p-8 text-center text-sm text-slate-600">Düzenlemek ve atama yapmak için bir talep seçin.</p>}</div>
          </section>}

          {tab === "workers" && <section className="grid gap-5 xl:grid-cols-[.8fr,1.2fr]"><form onSubmit={submitWorker} className="h-fit border border-[#dce4dc] bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-black">{editingWorkerId ? "Usta profilini düzenle" : "Yeni usta kaydı"}</h2>{editingWorkerId && <button type="button" onClick={() => { setEditingWorkerId(null); setWorkerForm(blankWorker); }} aria-label="Yeni kayıt"><Plus size={18} /></button>}</div><div className="mt-4 space-y-3"><label className="block text-sm font-semibold">Ad soyad<input required value={workerForm.name} onChange={(event) => setWorkerForm({ ...workerForm, name: event.target.value })} className="form-control mt-1" /></label><label className="block text-sm font-semibold">Uzmanlık<select value={workerForm.expertiseId} onChange={(event) => setWorkerForm({ ...workerForm, expertiseId: Number(event.target.value) })} className="form-control mt-1">{expertises.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-sm font-semibold">Durum<select value={workerForm.status} onChange={(event) => setWorkerForm({ ...workerForm, status: event.target.value as "ACTIVE" | "INACTIVE" })} className="form-control mt-1"><option value="ACTIVE">Aktif</option><option value="INACTIVE">Pasif</option></select></label><label className="block text-sm font-semibold">Telefon<input value={workerForm.phone} onChange={(event) => setWorkerForm({ ...workerForm, phone: event.target.value })} className="form-control mt-1" /></label><label className="block text-sm font-semibold">E-posta<input type="email" value={workerForm.email} onChange={(event) => setWorkerForm({ ...workerForm, email: event.target.value })} className="form-control mt-1" /></label><label className="block text-sm font-semibold">Profil fotoğrafı URL<input type="url" value={workerForm.imageUrl} onChange={(event) => setWorkerForm({ ...workerForm, imageUrl: event.target.value })} className="form-control mt-1" /></label><label className="block text-sm font-semibold">Profil notu<textarea rows={3} value={workerForm.bio} onChange={(event) => setWorkerForm({ ...workerForm, bio: event.target.value })} className="form-control mt-1" /></label><button disabled={saving} className="flex w-full items-center justify-center gap-2 bg-[#173f37] px-4 py-3 font-bold text-white"><Save size={16} /> {editingWorkerId ? "Profili güncelle" : "Usta ekle"}</button></div></form><div><h2 className="text-xl font-black">Usta listesi <span className="text-sm font-semibold text-slate-500">{workers.length}</span></h2><div className="mt-3 grid gap-2 md:grid-cols-2">{workers.map((worker) => <article key={worker.id ?? worker.workerId} className="flex items-start gap-3 border border-[#dce4dc] bg-white p-4">{worker.imageUrl ? <img src={worker.imageUrl} alt="" className="h-12 w-12 object-cover" /> : <div className="grid h-12 w-12 place-items-center bg-[#e7ece5] text-[#397568]"><Users size={20} /></div>}<div className="min-w-0 flex-1"><h3 className="font-bold">{worker.name}</h3><p className="text-sm text-slate-600">{worker.expertiseName} · {(worker.status ?? worker.daily_status) === "ACTIVE" ? "Aktif" : "Pasif"}</p><p className="mt-1 text-xs text-slate-500">{worker.phone || worker.email || worker.bio || "Profil bilgisi eklenmemiş"}</p></div><button onClick={() => { setEditingWorkerId(worker.id ?? worker.workerId ?? null); setWorkerForm({ name: worker.name, expertiseId: worker.expertiseId, status: worker.status ?? worker.daily_status ?? "ACTIVE", phone: worker.phone ?? "", email: worker.email ?? "", bio: worker.bio ?? "", imageUrl: worker.imageUrl ?? "" }); }} className="text-sm font-bold text-[#8e4929]">Düzenle</button></article>)}</div></div></section>}

          {tab === "expertises" && <section className="grid gap-5 xl:grid-cols-[.8fr,1.2fr]"><form onSubmit={submitExpertise} className="h-fit border border-[#dce4dc] bg-white p-5"><h2 className="text-xl font-black">{editingExpertiseId ? "Uzmanlığı düzenle" : "Yeni uzmanlık alanı"}</h2><div className="mt-4 space-y-3"><label className="block text-sm font-semibold">Uzmanlık adı<input required value={expertiseForm.name} onChange={(event) => setExpertiseForm({ ...expertiseForm, name: event.target.value })} className="form-control mt-1" /></label><label className="block text-sm font-semibold">Açıklama<textarea rows={3} value={expertiseForm.description} onChange={(event) => setExpertiseForm({ ...expertiseForm, description: event.target.value })} className="form-control mt-1" /></label><label className="block text-sm font-semibold">Kapak fotoğrafı URL<input type="url" value={expertiseForm.imageUrl} onChange={(event) => setExpertiseForm({ ...expertiseForm, imageUrl: event.target.value })} className="form-control mt-1" /></label><button disabled={saving} className="flex w-full items-center justify-center gap-2 bg-[#173f37] px-4 py-3 font-bold text-white"><Save size={16} /> {editingExpertiseId ? "Uzmanlığı güncelle" : "Uzmanlık ekle"}</button></div></form><div><h2 className="text-xl font-black">Uzmanlık alanları</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{expertises.map((item, index) => <article key={item.id} className="overflow-hidden border border-[#dce4dc] bg-white"><div className="h-36 bg-cover bg-center" style={{ backgroundImage: `url('${item.imageUrl || item.image_url || `https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=85`}')` }} /><div className="p-4"><div className="flex justify-between gap-3"><h3 className="font-bold">{item.name}</h3><button onClick={() => { setEditingExpertiseId(item.id); setExpertiseForm({ name: item.name, description: item.description ?? "", imageUrl: item.imageUrl ?? item.image_url ?? "" }); }} className="text-sm font-bold text-[#8e4929]">Düzenle</button></div><p className="mt-1 text-sm text-slate-600">{item.description || "Açıklama eklenmemiş"}</p></div></article>)}</div></div></section>}
          {tab === "workers" && editingWorkerId && <ProfilePhotoField portalIntoForm=".admin-layout form" label="Profil fotoğrafı" src={workerForm.imageUrl || workers.find((worker) => (worker.id ?? worker.workerId) === editingWorkerId)?.imageUrl || defaultWorkerImage} file={workerPhotoFile} onFileChange={setWorkerPhotoFile} />}
          {tab === "expertises" && editingExpertiseId && <ProfilePhotoField portalIntoForm=".admin-layout form" label="Kapak fotoğrafı" src={expertiseForm.imageUrl || expertises.find((expertise) => expertise.id === editingExpertiseId)?.imageUrl || expertises.find((expertise) => expertise.id === editingExpertiseId)?.image_url || defaultExpertiseImage} file={expertisePhotoFile} onFileChange={setExpertisePhotoFile} />}
        </>}
      </div>
    </main>
  );
}