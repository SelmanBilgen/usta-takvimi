"use client";

import { useMemo, useState } from "react";

import { CapacityCalendar } from "../../components/capacity-calendar";

const expertiseOptions = [
  { id: 1, label: "Boyaci" },
  { id: 2, label: "Tesisatci" },
  { id: 3, label: "Elektrikci" }
];

const sampleAvailability = [
  { date: "2026-10-11", status: "AVAILABLE" as const },
  { date: "2026-10-12", status: "LIMITED" as const },
  { date: "2026-10-13", status: "FULL" as const },
  { date: "2026-10-14", status: "AVAILABLE" as const }
];

export default function RequestPage() {
  const [expertiseId, setExpertiseId] = useState<number>(1);

  const events = useMemo(() => {
    // In production, load /api/v1/availability by selected expertise and visible date range.
    return sampleAvailability;
  }, [expertiseId]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-black text-slate-900">Yeni Is Talebi</h1>
      <p className="mt-2 text-slate-700">Uzmanlik sec, musaitlik durumunu incele ve talep formunu gonder.</p>

      <section className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div>
          <label htmlFor="expertise" className="mb-2 block text-sm font-semibold text-slate-700">
            Uzmanlik Alani
          </label>
          <select
            id="expertise"
            value={expertiseId}
            onChange={(e) => setExpertiseId(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none ring-brand-300 transition focus:ring-2"
          >
            {expertiseOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <div className="mt-4">
            <CapacityCalendar events={events} />
          </div>
        </div>

        <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Talep Formu</h2>
          <div className="mt-4 space-y-3">
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Baslangic Tarihi (YYYY-MM-DD)" />
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Bitis Tarihi (YYYY-MM-DD)" />
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Tahmini Isci Sayisi" />
            <textarea className="h-28 w-full rounded-xl border border-slate-300 px-3 py-2" placeholder="Aciklama" />
            <button type="button" className="w-full rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700">
              Talep Gonder
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
