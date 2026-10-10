"use client";

import { ImagePlus } from "lucide-react";
import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";

import { api } from "../lib/api";

interface EditableImageProps {
  imageKey: string;
  src: string;
  alt: string;
  className: string;
  imageClassName?: string;
  children?: ReactNode;
}

export function EditableImage({ imageKey, src, alt, className, imageClassName = "", children }: EditableImageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(src);
  const [canEdit, setCanEdit] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setCanEdit(Boolean(localStorage.getItem("ustatakvimi_admin_token")));
    api.get<{ images: Record<string, string> }>("/site-images")
      .then((result) => { if (result.images?.[imageKey]) setImageUrl(result.images[imageKey]); })
      .catch(() => undefined);
  }, [imageKey, src]);

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadError("JPG, PNG veya WebP seçin.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("Dosya boyutu 8 MB sınırını aşamaz.");
      return;
    }
    const body = new FormData();
    body.append("image", file);
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await api.upload<{ imageUrl: string }>(`/admin/manage/site-images/${encodeURIComponent(imageKey)}`, body);
      setImageUrl(result.imageUrl);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Görsel yüklenemedi.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className={`group relative overflow-hidden ${className}`}>
      <img src={imageUrl} alt={alt} className={`h-full w-full object-cover ${imageClassName}`} />
      {children}
      {canEdit && <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-end bg-transparent p-2 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100 group-focus-within:opacity-100">
        <button type="button" onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }} disabled={isUploading} title="Görseli değiştir" aria-label="Görseli değiştir" className="pointer-events-auto inline-flex items-center gap-2 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow disabled:opacity-60">
          <ImagePlus size={15} />{isUploading ? "Yükleniyor..." : "Görseli değiştir"}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} className="hidden" />
        {uploadError && <span role="alert" className="pointer-events-auto absolute right-2 top-12 max-w-56 bg-white px-2 py-1 text-xs text-rose-700 shadow">{uploadError}</span>}
      </div>}
    </div>
  );
}