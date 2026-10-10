"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, HardHat, LogOut, Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { api } from "../../lib/api";
import { formatDate } from "../../lib/date-format";

interface WorkerTask {
  assignmentId: number;
  requestId: number;
  date: string;
  expertiseName: string;
  clientName: string;
  requestDescription: string | null;
  estimatedWorkerCount: number;
  requestStatus: string;
  workStatus: "IN_PROGRESS" | "COMPLETED";
  workDescription: string;
  workUpdatedAt: string | null;
}
interface WorkerTasksResponse { tasks: WorkerTask[] }
interface WorkDraft { status: "IN_PROGRESS" | "COMPLETED"; workDescription: string }

export default function WorkerPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [drafts, setDrafts] = useState<Record<number, WorkDraft>>({});
  const [workerName, setWorkerName] = useState("Usta");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadTasks() {
    setLoading(true);
    try {
      const response = await api.get<WorkerTasksResponse>("/worker/tasks");
      setTasks(response.tasks ?? []);
      setDrafts(Object.fromEntries((response.tasks ?? []).map((task) => [task.assignmentId, {
        status: task.workStatus,
        workDescription: task.workDescription
      }])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Atanan işler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!localStorage.getItem("ustatakvimi_worker_token")) {
      router.replace("/login");
      return;
    }
    setWorkerName(localStorage.getItem("ustatakvimi_account_name") ?? "Usta");
    void loadTasks();
  }, [router]);

  async function saveTask(event: FormEvent<HTMLFormElement>, task: WorkerTask) {
    event.preventDefault();
    const draft = drafts[task.assignmentId];
    if (!draft) return;
    setSavingId(task.assignmentId);
    setError(null);
    setMessage(null);
    try {
      await api.put(`/worker/tasks/${task.assignmentId}`, draft);
      setMessage(`${formatDate(task.date)} tarihli iş güncellendi.`);
      await loadTasks();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "İş raporu kaydedilemedi.");
    } finally {
      setSavingId(null);
    }
  }

  function logout() {
    localStorage.removeItem("ustatakvimi_worker_token");
    localStorage.removeItem("ustatakvimi_account_name");
    localStorage.removeItem("ustatakvimi_account_role");
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-[#f4f6f1] text-[#172c28]">
      <header className="border-b border-[#dce4dc] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3"><Link href="/" aria-label="Geri" className="grid h-9 w-9 place-items-center border border-slate-200"><ArrowLeft size={17} /></Link><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b35e32]">Usta çalışma alanı</p><h1 className="text-xl font-black">{workerName}</h1></div></div>
          <button onClick={logout} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><LogOut size={16} /> Çıkış</button>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-7 md:px-8">
        <div className="mb-5"><h2 className="text-2xl font-black">Atanan işler</h2><p className="mt-1 text-sm text-slate-600">Her çalışma günü için ilerleme durumunu ve yapılan işi kaydedin.</p></div>
        {error && <p role="alert" className="mb-4 border-l-2 border-rose-600 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        {message && <p role="status" className="mb-4 border-l-2 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</p>}
        {loading ? <p className="py-8 text-sm text-slate-600">İşler yükleniyor...</p> : tasks.length === 0 ? <div className="border border-dashed border-[#c8d3c8] bg-white p-8 text-center"><ClipboardCheck className="mx-auto text-[#397568]" /><h3 className="mt-3 font-bold">Henüz atanmış iş yok</h3><p className="mt-1 text-sm text-slate-600">Yeni bir iş atandığında burada görebilirsiniz.</p></div> : <div className="space-y-4">
          {tasks.map((task) => {
            const draft = drafts[task.assignmentId] ?? { status: task.workStatus, workDescription: task.workDescription };
            return <article key={task.assignmentId} className="border border-[#dce4dc] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b35e32]">{formatDate(task.date)} · Talep #{task.requestId}</p><h3 className="mt-1 text-xl font-black">{task.expertiseName}</h3><p className="mt-1 text-sm text-slate-600">Müşteri: {task.clientName} · Tahmini usta: {task.estimatedWorkerCount}</p></div><span className={`px-3 py-1 text-xs font-bold ${draft.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{draft.status === "COMPLETED" ? "Tamamlandı" : "Devam ediyor"}</span></div>
              {task.requestDescription && <p className="mt-4 border-l-2 border-slate-300 pl-3 text-sm leading-6 text-slate-600">Talep: {task.requestDescription}</p>}
              <form onSubmit={(event) => saveTask(event, task)} className="mt-5 grid gap-4 md:grid-cols-[.45fr,1fr]">
                <div><span className="text-sm font-semibold">İş durumu</span><div role="group" aria-label="İş durumu" className="mt-1 grid grid-cols-2 border border-[#dce4dc]"><button type="button" aria-pressed={draft.status === "IN_PROGRESS"} onClick={() => setDrafts((current) => ({ ...current, [task.assignmentId]: { ...draft, status: "IN_PROGRESS" } }))} className={`px-3 py-2 text-sm font-semibold ${draft.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-900" : "bg-white text-slate-600"}`}>Devam ediyor</button><button type="button" aria-pressed={draft.status === "COMPLETED"} onClick={() => setDrafts((current) => ({ ...current, [task.assignmentId]: { ...draft, status: "COMPLETED" } }))} className={`px-3 py-2 text-sm font-bold ${draft.status === "COMPLETED" ? "bg-emerald-700 text-white" : "bg-white text-slate-600"}`}>Tamamlandı</button></div></div>
                <label className="text-sm font-semibold">Yapılan işlem açıklaması<textarea required minLength={3} maxLength={2000} rows={3} value={draft.workDescription} onChange={(event) => setDrafts((current) => ({ ...current, [task.assignmentId]: { ...draft, workDescription: event.target.value } }))} className="form-control mt-1" placeholder="Yapılan işlem ve varsa dikkat edilmesi gerekenler..." /></label>
                <button disabled={savingId === task.assignmentId} className="inline-flex items-center justify-center gap-2 bg-[#173f37] px-4 py-3 font-bold text-white md:col-start-2"><Save size={16} />{savingId === task.assignmentId ? "Kaydediliyor..." : "İş güncellemesini kaydet"}</button>
              </form>
            </article>;
          })}
        </div>}
        <Link href="/" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><HardHat size={16} /> Ana sayfaya dön</Link>
+      </div>
+    </main>
  );
}
