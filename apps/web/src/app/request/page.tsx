"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, HardHat, Paintbrush, PlugZap, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CapacityCalendar } from "../../components/capacity-calendar";
import { DateField } from "../../components/date-field";
import { EditableImage } from "../../components/editable-image";
import { api } from "../../lib/api";

interface Expertise { id: number; name: string; description?: string | null; imageUrl?: string | null; image_url?: string }
interface AvailabilityDay { date: string; status: "AVAILABLE" | "LIMITED" | "FULL"; freeCapacity: number; totalCapacity: number }
interface AvailabilityResponse { expertiseId: number; days: AvailabilityDay[] }
interface RequestResult { requestId: number; status: "PENDING" }
interface ExpertiseResponse { expertises: Expertise[] }

const photos = [
  "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=900&q=85"
];
const icons = [Paintbrush, Wrench, PlugZap, HardHat];
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
const specialtyPhotoById: Record<number, string> = {
  1: photos[0],
  2: photos[1],
  3: photos[2]
};
const specialtyIconById: Record<number, typeof Paintbrush> = {
  1: Paintbrush,
  2: Wrench,
  3: PlugZap
};
function todayString() { return dateKey(new Date()); }
function currentMonthRange() {
  const now = new Date();
  return {
    startDate: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  };
}

export default function RequestPage() {
  const router = useRouter();
  const [expertises, setExpertises] = useState<Expertise[]>([]);
  const [expertiseId, setExpertiseId] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [calendarRange, setCalendarRange] = useState({ startDate: "", endDate: "" });
  const [today, setToday] = useState("");
  const [estimatedWorkerCount, setEstimatedWorkerCount] = useState(1);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [isCustomer, setIsCustomer] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountRole, setAccountRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RequestResult | null>(null);

  useEffect(() => {
    setToday(todayString());
    setCalendarRange(currentMonthRange());
    setIsCustomer(Boolean(localStorage.getItem("ustatakvimi_customer_token")));
    setAccountName(localStorage.getItem("ustatakvimi_account_name"));
    setAccountRole(localStorage.getItem("ustatakvimi_account_role"));
    api.get<ExpertiseResponse>("/expertises").then((response) => {
      setExpertises(response.expertises ?? []);
      setExpertiseId(response.expertises?.[0]?.id ?? 0);
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Uzmanlık alanları yüklenemedi."));
  }, []);

  useEffect(() => {
    if (!expertiseId || !calendarRange.startDate || !calendarRange.endDate) return;
    let current = true;
    setIsLoading(true);
    api.get<AvailabilityResponse>(`/availability?expertiseId=${expertiseId}&startDate=${calendarRange.startDate}&endDate=${calendarRange.endDate}`)
      .then((data) => { if (current) setAvailability(data.days ?? []); })
      .catch((loadError) => { if (current) setError(loadError instanceof Error ? loadError.message : "Müsaitlik yüklenemedi."); })
      .finally(() => { if (current) setIsLoading(false); });
    return () => { current = false; };
  }, [expertiseId, calendarRange]);

  const events = useMemo(() => availability, [availability]);
  const currentExpertise = expertises.find((item) => item.id === expertiseId);
  const onDateClick = (date: string) => {
    if (date < todayString()) return;
    setSuccess(null);
    if (!startDate || (startDate && endDate) || date < startDate) {
      setStartDate(date);
      setEndDate("");
    } else {
      setEndDate(date);
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setSuccess(null);
    if (!startDate || !endDate) { setError("Başlangıç ve bitiş tarihlerini seçin."); return; }
    setIsSubmitting(true);
    try {
      const result = await api.post<RequestResult>("/requests", {
        expertiseId, startDate, endDate,
        description: description.trim() || undefined,
        estimatedWorkerCount,
        ...(!isCustomer ? { contact: { name, phone, email: email || undefined } } : {})
      });
      setSuccess(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Talebiniz gönderilemedi.");
    } finally { setIsSubmitting(false); }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f1] text-[#172c28]">
      <header className="border-b border-[#dce4dc] bg-[#f4f6f1]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm font-black"><HardHat className="h-5 w-5 text-[#b35e32]" /> UstaTakvimi</Link>
          <nav className="flex items-center gap-3 text-sm font-semibold"><Link href="/" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-950"><ArrowLeft size={15} /> Geri</Link>{accountName ? <><Link href={accountRole === "admin" ? "/admin" : accountRole === "worker" ? "/worker" : "/customer"} className="max-w-36 truncate text-emerald-900">{accountName}</Link><button onClick={() => { localStorage.removeItem("ustatakvimi_customer_token"); localStorage.removeItem("ustatakvimi_admin_token"); localStorage.removeItem("ustatakvimi_worker_token"); localStorage.removeItem("ustatakvimi_account_name"); localStorage.removeItem("ustatakvimi_account_role"); setAccountName(null); setAccountRole(null); setIsCustomer(false); router.refresh(); }} className="text-slate-600">Çıkış</button></> : <Link href="/login" className="text-emerald-900">Giriş</Link>}</nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-8 md:pt-12">
        <section className="grid gap-8 lg:grid-cols-[1.1fr,.9fr] lg:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#b35e32]">İşiniz için uzman ekip</p>
            <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">Projenize uygun ustayı, ihtiyacınız olan tarihte bulun.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">İş türünü seçin, takvimden çalışma aralığını belirleyin ve ekibinizi talep edin. Talebiniz ekibimiz tarafından kısa süre içinde değerlendirilsin.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-700"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e7ece5] text-[#b35e32]">1</span> Uzmanlığı seç <ArrowRight size={15} /><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e7ece5] text-[#b35e32]">2</span> Tarihleri belirle <ArrowRight size={15} /><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e7ece5] text-[#b35e32]">3</span> Talep gönder</div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">{photos.map((photo, index) => <EditableImage key={photo} imageKey={`request-gallery-${index + 1}`} src={photo} alt={["Boya ustası", "Tesisat ustası", "Elektrik ustası"][index]} className={`h-36 sm:h-48 ${index === 1 ? "translate-y-4" : ""}`} />)}</div>
        </section>

        <section className="mt-14 grid gap-8 xl:grid-cols-[1.15fr,.85fr]">
          <div>
            <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#b35e32]">Hizmetler</p><h2 className="mt-1 text-2xl font-black">Hangi uzmanlığa ihtiyacınız var?</h2></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {expertises.map((item, index) => {
                const Icon = specialtyIconById[item.id] ?? icons[index % icons.length];
                const image = item.imageUrl || item.image_url || specialtyPhotoById[item.id] || photos[index % photos.length];
                const selected = item.id === expertiseId;
                return <div key={item.id} role="button" tabIndex={0} onClick={() => setExpertiseId(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpertiseId(item.id); } }} aria-pressed={selected} className={`group overflow-hidden text-left transition ${selected ? "outline outline-2 outline-[#b35e32]" : "outline outline-1 outline-[#dce4dc] hover:outline-[#a7b7aa]"}`}>
                  <EditableImage imageKey={`expertise-${item.id}`} src={image} alt={item.name} className="relative h-36">
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d2520]/75 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-end justify-between text-white"><div><Icon size={17} /><h3 className="mt-1 text-lg font-bold">{item.name}</h3></div>{selected && <Check size={19} />}</div>
                  </EditableImage>
                  <p className="bg-white px-4 py-3 text-sm leading-5 text-slate-600">{item.description || "Projeniz için deneyimli ve güvenilir uzman ekibi talep edin."}</p>
                </div>;
              })}
            </div>

            <div className="mt-8 border border-[#dce4dc] bg-white p-3 sm:p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="text-xl font-black">Çalışma tarihleri</h2><p className="mt-1 text-sm text-slate-600">Takvimde bir güne dokunarak başlangıcı, ardından bitişi seçin.</p></div>{isLoading && <span className="text-xs font-semibold text-slate-500">Müsaitlik yükleniyor</span>}</div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <DateField label="Başlangıç tarihi" value={startDate} min={today} onChange={(value) => { setStartDate(value); if (value && endDate && value > endDate) setEndDate(""); setSuccess(null); }} />
                <DateField label="Bitiş tarihi" value={endDate} min={startDate || today} onChange={(value) => { setEndDate(value); setSuccess(null); }} />
              </div>
              <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600"><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 bg-emerald-500" /> Müsait</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 bg-amber-500" /> Sınırlı</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 bg-rose-500" /> Dolu</span></div>
              <CapacityCalendar events={events} startDate={startDate} endDate={endDate} onDateClick={onDateClick} onVisibleRangeChange={(visibleStart, visibleEnd) => setCalendarRange((current) => current.startDate === visibleStart && current.endDate === visibleEnd ? current : { startDate: visibleStart, endDate: visibleEnd })} />
              {currentExpertise && <p className="mt-3 text-sm text-slate-600">Seçilen hizmet: <strong className="text-slate-900">{currentExpertise.name}</strong></p>}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="h-fit border border-[#dce4dc] bg-white p-5 sm:p-7 xl:sticky xl:top-5">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#b35e32]">İstek oluştur</p><h2 className="mt-1 text-2xl font-black">Proje detayları</h2>
            <label className="mt-5 block text-sm font-semibold">Tahmini usta sayısı<input type="number" min={1} max={50} value={estimatedWorkerCount} onChange={(event) => setEstimatedWorkerCount(Number(event.target.value) || 1)} className="form-control mt-1.5" /></label>
            <label className="mt-4 block text-sm font-semibold">İş hakkında kısa bilgi<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className="form-control mt-1.5 resize-y" placeholder="İşin kapsamı, adres veya özel gereksinimler..." /></label>
            {!isCustomer && <div className="mt-5 border-t border-[#e5e9e3] pt-4"><h3 className="font-bold">İletişim bilgileriniz</h3><p className="mt-1 text-sm text-slate-600">Misafir talebi için geri dönüş bilgisi gereklidir.</p>
              <label className="mt-3 block text-sm font-semibold">Ad soyad / firma<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className="form-control mt-1.5" autoComplete="name" /></label>
              <label className="mt-3 block text-sm font-semibold">Telefon<input required value={phone} onChange={(event) => setPhone(event.target.value)} className="form-control mt-1.5" type="tel" autoComplete="tel" /></label>
              <label className="mt-3 block text-sm font-semibold">E-posta <span className="font-normal text-slate-500">(isteğe bağlı)</span><input value={email} onChange={(event) => setEmail(event.target.value)} className="form-control mt-1.5" type="email" autoComplete="email" /></label>
            </div>}
            {error && <p role="alert" className="mt-4 border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            {success && <p role="status" className="mt-4 border-l-2 border-emerald-700 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Talebiniz alındı. Referans numaranız <strong>#{success.requestId}</strong>.</p>}
            <button type="submit" disabled={isSubmitting || !expertiseId} className="mt-5 flex w-full items-center justify-center gap-2 bg-[#b35e32] px-4 py-3.5 font-bold text-white transition hover:bg-[#984b28] disabled:opacity-60">{isSubmitting ? "Gönderiliyor..." : "Talep gönder"}<ArrowRight size={17} /></button>
            {!isCustomer && <p className="mt-4 text-center text-sm text-slate-600">Sonraki taleplerinizde bilgilerinizi tekrar girmemek için <Link href="/login" className="font-semibold text-emerald-900 underline underline-offset-4">hesap oluşturun</Link>.</p>}
          </form>
        </section>
      </div>
    </main>
  );
}