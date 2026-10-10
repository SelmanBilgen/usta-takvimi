"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { api } from "../../../lib/api";

interface Worker { id: number; workerId?: number; name: string; email?: string | null; expertiseName?: string }

export default function WorkerAccessPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadWorkers() {
    setLoading(true);
    try {
      const response = await api.get<{ workers: Worker[] }>("/admin/manage/workers");
      setWorkers(response.workers ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Usta listesi yüklenemedi.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!localStorage.getItem("ustatakvimi_admin_token")) {
      router.replace("/login");
      return;
    }
    void loadWorkers();
  }, [router]);

  const selectedWorker = workers.find((worker) => String(worker.id ?? worker.workerId) === workerId);

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workerId) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      await api.put(`/admin/manage/workers/${workerId}/account`, { email, password });
      setPassword("");
      setMessage(`${selectedWorker?.name ?? "Usta"} için giriş bilgileri kaydedildi.`);
      await loadWorkers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Giriş bilgileri kaydedilemedi.");
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f1] text-[#172c28]">
      <header className="border-b border-[#dce4dc] bg-white"><div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 md:px-8"><Link href="/admin" aria-label="Yönetim paneline dön" className="grid h-9 w-9 place-items-center border border-slate-200"><ArrowLeft size={17} /></Link><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b35e32]">Yönetim</p><h1 className="text-xl font-black">Usta giriş bilgileri</h1></div></div></header>
      <div className="mx-auto max-w-3xl px-4 py-7 md:px-8"><section className="border border-[#dce4dc] bg-white p-5 sm:p-7"><div className="flex items-start gap-3"><KeyRound className="mt-1 text-[#b35e32]" /><div><h2 className="text-lg font-black">Usta hesabı tanımla</h2><p className="mt-1 text-sm text-slate-600">Usta, bu e-posta ve şifreyle giriş yaparak kendisine atanan işleri görür.</p></div></div>
          {error && <p role="alert" className="mt-4 border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          {message && <p role="status" className="mt-4 border-l-2 border-emerald-700 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message}</p>}
          {loading ? <p className="mt-5 text-sm text-slate-600">Ustalar yükleniyor...</p> : <form onSubmit={saveAccount} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold">Usta<select required value={workerId} onChange={(event) => { const nextId = event.target.value; const worker = workers.find((item) => String(item.id ?? item.workerId) === nextId); setWorkerId(nextId); setEmail(worker?.email ?? ""); setPassword(""); }} className="form-control mt-1"><option value="">Usta seçin</option>{workers.map((worker) => <option key={worker.id ?? worker.workerId} value={worker.id ?? worker.workerId}>{worker.name}{worker.expertiseName ? ` · ${worker.expertiseName}` : ""}</option>)}</select></label>
            {selectedWorker && <p className="text-xs text-slate-500">Mevcut giriş e-postası: {selectedWorker.email || "Tanımlanmamış"}</p>}
            <label className="block text-sm font-semibold">Giriş e-postası<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="form-control mt-1" autoComplete="username" /></label>
            <label className="block text-sm font-semibold">Yeni şifre<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="form-control mt-1" autoComplete="new-password" /></label>
            <button disabled={saving || !workerId} className="inline-flex items-center gap-2 bg-[#173f37] px-4 py-3 font-bold text-white disabled:opacity-50"><Save size={16} />{saving ? "Kaydediliyor..." : "Giriş bilgilerini kaydet"}</button>
          </form>}
        </section></div>
+    </main>
  );
}
