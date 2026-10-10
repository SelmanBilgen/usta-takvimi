"use client";

import { useState } from "react";

const mockRequests = [
  {
    id: 101,
    client: "Akar Yapi",
    expertise: "Elektrikci",
    startDate: "2026-10-15",
    endDate: "2026-10-18",
    estimatedWorkerCount: 2
  },
  {
    id: 102,
    client: "Deniz Insaat",
    expertise: "Tesisatci",
    startDate: "2026-10-16",
    endDate: "2026-10-17",
    estimatedWorkerCount: 1
  }
];

const mockWorkers = [
  { workerId: 1, name: "Murat K.", fullyAvailable: true, conflictingDates: [] },
  { workerId: 2, name: "Ali T.", fullyAvailable: false, conflictingDates: ["2026-10-16"] }
];

export default function AdminPage() {
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-black text-slate-900">Yonetici Paneli</h1>
      <p className="mt-2 text-slate-700">Bekleyen talepleri inceleyip uygun iscileri manuel atayabilirsiniz.</p>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Bekleyen Talepler</h2>
          <div className="mt-4 space-y-3">
            {mockRequests.map((req) => (
              <button
                key={req.id}
                onClick={() => setSelectedRequestId(req.id)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50"
              >
                <p className="font-semibold">#{req.id} - {req.client}</p>
                <p className="text-sm text-slate-600">{req.expertise} | {req.startDate} / {req.endDate}</p>
                <p className="text-sm text-slate-600">Tahmini Isci: {req.estimatedWorkerCount}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Musait Isciler</h2>
          {!selectedRequestId ? (
            <p className="mt-3 text-sm text-slate-600">Lutfen soldan bir talep secin.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {mockWorkers.map((worker) => (
                <div key={worker.workerId} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-semibold">{worker.name}</p>
                  {worker.fullyAvailable ? (
                    <p className="text-sm text-emerald-700">Tamamen musait</p>
                  ) : (
                    <p className="text-sm text-rose-700">Cakisma var: {worker.conflictingDates.join(", ")}</p>
                  )}
                </div>
              ))}
              <button type="button" className="w-full rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700">
                Secili Iscileri Ata
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
