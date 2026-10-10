"use client";

import { ImagePlus, X } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ProfilePhotoField({
  label,
  src,
  file,
  onFileChange,
  portalIntoForm
}: {
  label: string;
  src: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  portalIntoForm: string;
}) {
  const [preview, setPreview] = useState(src);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(portalIntoForm);
    const fields = form?.querySelector<HTMLElement>(".mt-4.space-y-3");
    if (!fields) return;
    const host = document.createElement("div");
    host.className = "mb-3";
    fields.prepend(host);
    setPortalHost(host);
    return () => {
      setPortalHost(null);
      host.remove();
    };
  }, [portalIntoForm]);

  useEffect(() => {
    if (!file) {
      setPreview(src);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, src]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) return;
    if (selected.size > 8 * 1024 * 1024) return;
    onFileChange(selected);
  }

  const field = (
    <div className="w-full">
      <span className="block text-sm font-semibold">{label}</span>
      <div className="mt-2 flex items-center gap-4 border border-[#dce4dc] bg-[#f7f8f5] p-3">
        <img src={preview} alt={label} className="h-20 w-20 shrink-0 object-cover" />
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 bg-[#173f37] px-3 py-2 text-sm font-bold text-white">
            <ImagePlus size={16} /> Fotoğraf seç
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="sr-only" />
          </label>
          {file && <>
            <span className="max-w-48 truncate text-xs text-slate-600">{file.name} · kaydetmeyi bekliyor</span>
            <button type="button" onClick={() => onFileChange(null)} aria-label="Seçilen fotoğrafı kaldır" className="grid h-8 w-8 place-items-center border border-slate-300 bg-white text-slate-600"><X size={15} /></button>
          </>}
          <p className="w-full text-xs text-slate-500">JPG, PNG veya WebP, en fazla 8 MB. Fotoğraf profil kaydedilince yüklenir.</p>
        </div>
      </div>
    </div>
  );
  return portalHost ? createPortal(field, portalHost) : null;
}
