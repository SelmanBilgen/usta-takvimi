"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Hammer, LockKeyhole, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { api } from "../../lib/api";
import { EditableImage } from "../../components/editable-image";

interface AuthResponse { token: string; role: "admin" | "customer" | "worker"; username?: string; email?: string; displayName?: string }

export default function LoginPage() {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("ustatakvimi_admin_token")) router.replace("/admin");
    else if (localStorage.getItem("ustatakvimi_customer_token")) router.replace("/request");
    else if (localStorage.getItem("ustatakvimi_worker_token")) router.replace("/worker");
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setIsSubmitting(true); setError(null);
    try {
      const response = await api.post<AuthResponse>(isRegistering ? "/auth/register" : "/auth/login", isRegistering
        ? { name, phone, email: identifier, password }
        : { identifier, password });
      if (response.role === "admin") {
        localStorage.setItem("ustatakvimi_admin_token", response.token);
        localStorage.removeItem("ustatakvimi_customer_token");
        localStorage.removeItem("ustatakvimi_worker_token");
        localStorage.setItem("ustatakvimi_account_name", response.username ?? identifier);
        localStorage.setItem("ustatakvimi_account_role", "admin");
        router.push("/admin");
      } else if (response.role === "customer") {
        localStorage.setItem("ustatakvimi_customer_token", response.token);
        localStorage.removeItem("ustatakvimi_admin_token");
        localStorage.removeItem("ustatakvimi_worker_token");
        localStorage.setItem("ustatakvimi_account_name", response.displayName ?? response.email ?? identifier);
        localStorage.setItem("ustatakvimi_account_role", "customer");
        router.push("/request");
      } else {
        localStorage.setItem("ustatakvimi_worker_token", response.token);
        localStorage.removeItem("ustatakvimi_admin_token");
        localStorage.removeItem("ustatakvimi_customer_token");
        localStorage.setItem("ustatakvimi_account_name", response.displayName ?? response.email ?? identifier);
        localStorage.setItem("ustatakvimi_account_role", "worker");
        router.push("/worker");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Giriş tamamlanamadı.");
    } finally { setIsSubmitting(false); }
  }

  return (
    <main className="app-shell mobile-safe flex min-h-screen items-center">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden border border-white/70 bg-white/80 shadow-[0_26px_80px_rgba(14,38,34,0.13)] md:grid-cols-[0.9fr,1.1fr]">
        <aside className="relative hidden min-h-[620px] overflow-hidden bg-[#123b35] p-9 text-white md:flex md:flex-col md:justify-between">
          <EditableImage imageKey="login-hero" src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=90" alt="İnşaat ekibi" className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,35,32,.18),rgba(10,35,32,.88))]" />
          <Link href="/" className="relative inline-flex w-fit items-center gap-2 text-sm font-bold"><Hammer size={18} /> UstaTakvimi</Link>
          <div className="relative max-w-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Projeleriniz için usta gücü</p><h1 className="mt-4 text-4xl font-black leading-tight">Doğru uzman, doğru zamanda.</h1><p className="mt-4 text-sm leading-6 text-white/80">İnşaat ve tadilat işleriniz için uzman ekip talebinizi güvenle planlayın.</p></div>
        </aside>
        <section className="px-5 py-7 sm:px-9 md:px-12 md:py-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft size={16} /> Geri</Link>
          <div className="mt-8 flex items-center gap-3 text-emerald-800 md:hidden"><Hammer size={20} /><span className="font-bold">UstaTakvimi</span></div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">Müşteri ve yönetici girişi</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">{isRegistering ? "Hesap oluştur" : "Tekrar hoş geldiniz"}</h2>
          <p className="mt-2 text-sm text-slate-600">{isRegistering ? "Talep ve iletişim bilgilerinizi tek yerde yönetin." : "Müşteri, usta veya yönetici hesabınızla devam edin."}</p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {isRegistering && <>
              <label className="block text-sm font-semibold text-slate-700">Ad soyad / firma<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className="form-control mt-1.5" autoComplete="name" /></label>
              <label className="block text-sm font-semibold text-slate-700">Telefon<input required value={phone} onChange={(event) => setPhone(event.target.value)} className="form-control mt-1.5" type="tel" autoComplete="tel" /></label>
            </>}
            <label className="block text-sm font-semibold text-slate-700">{isRegistering ? "E-posta" : "E-posta veya yönetici adı"}<span className="relative mt-1.5 block"><UserRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="form-control pl-10" type={isRegistering ? "email" : "text"} autoComplete="username" /></span></label>
            <label className="block text-sm font-semibold text-slate-700">Şifre<span className="relative mt-1.5 block"><LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required minLength={isRegistering ? 8 : 4} value={password} onChange={(event) => setPassword(event.target.value)} className="form-control pl-10" type="password" autoComplete={isRegistering ? "new-password" : "current-password"} /></span></label>
            {error && <p role="alert" className="border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            <button disabled={isSubmitting} className="w-full bg-[#123b35] px-4 py-3.5 font-bold text-white transition hover:bg-[#1b5149] disabled:opacity-60">{isSubmitting ? "İşleniyor..." : isRegistering ? "Hesap oluştur" : "Giriş yap"}</button>
          </form>
          <button type="button" onClick={() => { setIsRegistering((value) => !value); setError(null); }} className="mt-5 text-sm font-semibold text-emerald-900 underline decoration-emerald-300 underline-offset-4">{isRegistering ? "Zaten hesabım var" : "Müşteri hesabı oluştur"}</button>
          <div className="mt-8 border-t border-slate-200 pt-5 text-sm text-slate-600">Hesap oluşturmadan talep mi vermek istiyorsunuz? <Link href="/request?guest=1" className="font-bold text-emerald-900 underline underline-offset-4">Misafir olarak devam edin</Link></div>
        </section>
      </div>
    </main>
  );
}