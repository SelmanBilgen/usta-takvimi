import Link from "next/link";
import { CalendarDays, Hammer, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <div className="rounded-3xl border border-white/60 bg-white/75 p-8 shadow-2xl backdrop-blur-sm">
        <p className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-800">
          <Hammer className="h-4 w-4" />
          Is Gucu Takvimi ve Talep Yonetimi
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900">UstaTakvimi</h1>
        <p className="mt-4 max-w-2xl text-slate-700">
          Insaat sirketleri icin uzmanlik bazli musaitlik takvimi, musteriden talep toplama ve yonetici tarafinda
          manuel atama akislarini tek platformda birlestirir.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link
            href="/request"
            className="group rounded-2xl border border-brand-200 bg-brand-50 p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center gap-3 text-brand-800">
              <CalendarDays className="h-5 w-5" />
              <span className="font-bold">Musteri Talep Ekrani</span>
            </div>
            <p className="mt-2 text-sm text-brand-900/80">Uzmanlik secip gun doluluk durumuna gore talep olustur.</p>
          </Link>

          <Link
            href="/admin"
            className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center gap-3 text-slate-800">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-bold">Yonetici Paneli</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">Bekleyen talepleri goruntule, uygun iscileri sec ve cakismasiz ata.</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
