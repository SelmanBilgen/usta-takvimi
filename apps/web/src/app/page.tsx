"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Hammer, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { EditableImage } from "../components/editable-image";

export default function HomePage() {
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountRole, setAccountRole] = useState<string | null>(null);

  useEffect(() => {
    setAccountName(localStorage.getItem("ustatakvimi_account_name"));
    setAccountRole(localStorage.getItem("ustatakvimi_account_role"));
  }, []);

  function logout() {
    localStorage.removeItem("ustatakvimi_admin_token");
    localStorage.removeItem("ustatakvimi_customer_token");
    localStorage.removeItem("ustatakvimi_worker_token");
    localStorage.removeItem("ustatakvimi_account_name");
    localStorage.removeItem("ustatakvimi_account_role");
    setAccountName(null);
    setAccountRole(null);
  }

  return (
    <main className="app-shell mobile-safe">
      <div className="mx-auto max-w-7xl pt-4 md:pt-8">
        <header className="flex items-center justify-between border-b border-[#dce4dc] pb-4">
          <Link href="/" className="flex items-center gap-2 font-black text-[#173f37]"><Hammer size={19} /> UstaTakvimi</Link>
          <div className="flex items-center gap-3 text-sm font-bold text-[#173f37]">
            {accountName ? <>
              <Link href={accountRole === "admin" ? "/admin" : accountRole === "worker" ? "/worker" : accountRole === "customer" ? "/customer" : "/request"} className="max-w-40 truncate">{accountName}</Link>
              <button onClick={logout} className="text-slate-500">Çıkış</button>
            </> : <Link href="/login" className="inline-flex items-center gap-2">Giriş <ArrowRight size={16} /></Link>}
          </div>
        </header>
        <section className="relative mt-5 min-h-[570px] overflow-hidden bg-[#173f37] text-white md:min-h-[640px]">
          <div className="absolute inset-0">
            <EditableImage imageKey="home-hero" src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1800&q=90" alt="İnşaat sahasında çalışan usta ekibi" className="h-full w-full" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(17,54,47,.94),rgba(17,54,47,.58),rgba(17,54,47,.08))]" />
          </div>
          <div className="relative flex min-h-[570px] max-w-3xl flex-col justify-center px-6 py-12 md:min-h-[640px] md:px-12">
            <span className="inline-flex w-fit items-center gap-2 border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em]"><CalendarDays size={15} /> İnşaat ve tadilat uzmanları</span>
            <h1 className="mt-6 text-4xl font-black leading-tight sm:text-6xl">İşiniz için doğru ustayı bulun.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/85 md:text-lg">Boyacı, tesisatçı ve elektrikçi ekiplerini ihtiyacınıza göre talep edin. Tarihlerinizi seçin, proje detaylarını paylaşın; gerisini biz planlayalım.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href={accountRole === "worker" ? "/worker" : accountName ? "/request" : "/login"} className="inline-flex items-center gap-2 bg-[#d17a48] px-5 py-3.5 font-bold text-white transition hover:bg-[#b96335]">{accountRole === "worker" ? "İşlerim" : "Usta talep et"} <ArrowRight size={17} /></Link>{!accountName && <Link href="/login" className="inline-flex items-center gap-2 border border-white/60 px-5 py-3.5 font-bold text-white hover:bg-white/10">Giriş</Link>}</div>
          </div>
        </section>
        <section className="grid gap-5 py-8 md:grid-cols-3 md:py-10">
          {[ [CalendarDays, "Tarihleri seçin", "Takvimden işe uygun başlangıç ve bitiş günlerini belirleyin."], [Hammer, "İş türünü belirleyin", "İhtiyacınıza göre doğru inşaat uzmanlığını seçin."], [ShieldCheck, "Talebinizi takip edin", "İletişim bilgilerinizi bırakın; ekibimiz sizinle iletişime geçsin."] ].map(([Icon, title, copy]) => {
            const FeatureIcon = Icon as typeof CalendarDays;
            return <article key={title as string} className="border-t-2 border-[#b35e32] bg-white px-4 py-5"><FeatureIcon className="text-[#b35e32]" size={20} /><h2 className="mt-3 font-black">{title as string}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{copy as string}</p></article>;
          })}
        </section>
      </div>
    </main>
  );
}
