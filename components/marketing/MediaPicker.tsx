"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Film,
  ImageIcon,
  Upload,
  X,
  Library,
  Plus,
} from "lucide-react";
import clsx from "clsx";
import { t } from "@/lib/i18n";
import type { Lang, MediaAsset } from "@/lib/types";
import { deleteMediaBlob } from "@/lib/mediaDb";
import { ingestMediaFile } from "@/lib/attachMedia";
import { useStore } from "@/store/useStore";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(sec?: number) {
  if (sec == null || !Number.isFinite(sec)) return null;
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

type Props = {
  language: Lang;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export function MediaPicker({
  language,
  selectedIds,
  onChange,
  disabled,
}: Props) {
  const mediaAssets = useStore((s) => s.mediaAssets);
  const addMediaAsset = useStore((s) => s.addMediaAsset);
  const removeMediaAsset = useStore((s) => s.removeMediaAsset);
  const userId = useStore((s) => s.session?.userId || "");
  const showToast = useStore((s) => s.showToast);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const selected = mediaAssets.filter((m) => selectedIds.includes(m.id));

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return false;
      setUploading(true);
      const added: string[] = [];
      try {
        for (const original of list) {
          const result = await ingestMediaFile(original, userId);
          if (!result.ok) {
            if (result.reason === "type") showToast(t(language, "mediaTypeInvalid"));
            else if (result.reason === "size") showToast(`${t(language, "mediaTooLarge")}: ${original.name} (${formatBytes(original.size)})`);
            else showToast(t(language, "mediaUploadFail"));
            continue;
          }
          if (result.cloudError) {
            showToast(
              `${language === "es" ? "No se pudo subir a la nube (se reintentará al publicar)" : "Cloud upload failed (will retry on publish)"}: ${result.cloudError}`
            );
          }
          addMediaAsset(result.asset);
          added.push(result.asset.id);
        }
        if (added.length) {
          onChange([...selectedIds, ...added.filter((id) => !selectedIds.includes(id))]);
          showToast(t(language, "mediaUploadOk"));
        }
        return added.length > 0;
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [addMediaAsset, language, onChange, selectedIds, showToast, userId]
  );

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) void processFiles(e.target.files);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    if (e.dataTransfer.files?.length) void processFiles(e.dataTransfer.files);
  }

  function detach(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  async function removeFromLibrary(id: string) {
    const asset = mediaAssets.find((m) => m.id === id);
    if (asset?.previewUrl) {
      try {
        URL.revokeObjectURL(asset.previewUrl);
      } catch {
        /* ignore */
      }
    }
    detach(id);
    removeMediaAsset(id);
    try {
      await deleteMediaBlob(id);
    } catch {
      /* ignore */
    }
  }

  function toggleLibraryAttach(id: string) {
    if (selectedIds.includes(id)) {
      detach(id);
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t(language, "mediaAttach")}
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowLibrary((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline disabled:opacity-40"
        >
          <Library className="h-3.5 w-3.5" />
          {showLibrary
            ? t(language, "mediaHideLibrary")
            : t(language, "mediaShowLibrary")}
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        className={clsx(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-6 text-center transition sm:px-4",
          dragging
            ? "border-[var(--brand)] bg-[var(--brand)]/5"
            : "border-slate-200 bg-slate-50/80 hover:border-slate-300",
          (disabled || uploading) && "cursor-not-allowed opacity-50"
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
          <Upload className="h-5 w-5 text-[var(--brand)]" />
        </div>
        <p className="text-sm font-medium text-slate-700">
          {t(language, "mediaDropHint")}
        </p>
        <p className="text-[11px] text-slate-400">{t(language, "mediaLimits")}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          disabled={disabled || uploading}
          onChange={onInputChange}
        />
      </div>

      {selected.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t(language, "mediaAttached")} ({selected.length})
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {selected.map((m) => (
              <MediaThumb
                key={m.id}
                asset={m}
                language={language}
                onRemove={() => detach(m.id)}
                removable
              />
            ))}
          </ul>
        </div>
      )}

      {showLibrary && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-semibold text-slate-700">
            {t(language, "mediaLibrary")}
          </div>
          {mediaAssets.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">
              {t(language, "mediaEmpty")}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {mediaAssets.map((m) => {
                const attached = selectedIds.includes(m.id);
                return (
                  <li key={m.id} className="relative">
                    <MediaThumb
                      asset={m}
                      language={language}
                      onRemove={() => void removeFromLibrary(m.id)}
                      removable
                    />
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleLibraryAttach(m.id)}
                      className={clsx(
                        "mt-1 flex w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold",
                        attached
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {attached ? (
                        t(language, "mediaAttached")
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          {t(language, "mediaReuse")}
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function MediaThumb({
  asset,
  language,
  onRemove,
  removable,
  compact,
}: {
  asset: MediaAsset;
  language: Lang;
  onRemove?: () => void;
  removable?: boolean;
  compact?: boolean;
}) {
  const preview = asset.previewUrl || (asset.kind === "image" ? asset.url : undefined);
  return (
    <div
      className={clsx(
        "group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100",
        compact ? "h-12 w-12" : "aspect-square"
      )}
    >
      {preview && asset.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={asset.name}
          className="h-full w-full object-cover"
        />
      ) : asset.previewUrl && asset.kind === "video" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.previewUrl}
          alt={asset.name}
          className="h-full w-full object-cover"
        />
      ) : asset.url && asset.kind === "video" ? (
        <video
          src={`${asset.url}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-slate-400">
          {asset.kind === "video" ? (
            <Film className="h-6 w-6" />
          ) : (
            <ImageIcon className="h-6 w-6" />
          )}
        </div>
      )}
      {!compact && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-4">
          <div className="truncate text-[10px] font-medium text-white">
            {asset.name}
          </div>
          <div className="flex items-center gap-1 text-[9px] text-white/80">
            <span>
              {asset.kind === "video"
                ? t(language, "mediaVideo")
                : t(language, "mediaImage")}
            </span>
            <span>·</span>
            <span>{formatBytes(asset.size)}</span>
            {asset.kind === "video" && formatDuration(asset.durationSec) && (
              <>
                <span>·</span>
                <span>{formatDuration(asset.durationSec)}</span>
              </>
            )}
          </div>
        </div>
      )}
      {!compact && (
        <span
          className={clsx(
            "absolute bottom-1 right-1 rounded px-1 py-0.5 text-[8px] font-bold uppercase",
            asset.url ? "bg-emerald-500/90 text-white" : "bg-amber-400/90 text-amber-950"
          )}
          title={asset.url ? "Cloud" : "Local"}
        >
          {asset.url ? (language === "es" ? "nube" : "cloud") : "local"}
        </span>
      )}
      {asset.kind === "video" && (
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-semibold text-white">
          <Film className="inline h-3 w-3" />
        </span>
      )}
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-90 hover:bg-black"
          aria-label={t(language, "mediaRemove")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Rehydrate object URLs from IndexedDB for assets missing previewUrl */
export function useMediaPreviewHydration() {
  const mediaAssets = useStore((s) => s.mediaAssets);
  const setMediaPreviewUrl = useStore((s) => s.setMediaPreviewUrl);
  const ran = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const { createPreviewUrl } = await import("@/lib/mediaDb");
      for (const asset of mediaAssets) {
        if (cancelled) return;
        if (asset.previewUrl) continue;
        const url = await createPreviewUrl(asset.id);
        if (url && !cancelled) setMediaPreviewUrl(asset.id, url);
        else if (!url && asset.url && asset.kind === "image" && !cancelled)
          setMediaPreviewUrl(asset.id, asset.url);
      }
    }
    if (!ran.current || mediaAssets.some((m) => !m.previewUrl)) {
      ran.current = true;
      void run();
    }
    return () => {
      cancelled = true;
    };
    // Intentionally re-run when asset ids without preview change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaAssets.map((m) => `${m.id}:${m.previewUrl ? 1 : 0}`).join("|")]);
}
