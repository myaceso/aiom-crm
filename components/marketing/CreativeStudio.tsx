"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, Film, ImageIcon, Loader2, Sparkles, Trash2 } from "lucide-react";
import { parseHashtags } from "@/lib/creative/copy";
import type { CreativeAsset, CreativeConfig, CreativeKind } from "@/lib/creative/types";
import { IMAGE_ASPECTS, VIDEO_ASPECTS } from "@/lib/creative/types";
import type { Lang } from "@/lib/types";

const endpoint = "/api/marketing/creative";

type UseItem = { file?: File; asset?: CreativeAsset };

const STYLES: { id: string; es: string; en: string }[] = [
  { id: "", es: "Sin estilo extra", en: "No extra style" },
  { id: "photo", es: "Fotorrealista", en: "Photorealistic" },
  { id: "illustration", es: "Ilustración", en: "Illustration" },
  { id: "minimal", es: "Minimalista", en: "Minimal" },
  { id: "cinematic", es: "Cinematográfico", en: "Cinematic" },
  { id: "watercolor", es: "Acuarela", en: "Watercolor" },
  { id: "render3d", es: "Render 3D", en: "3D render" },
];

const input = "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30";

function pick(language: Lang, copy?: { es: string; en: string } | null) {
  if (!copy) return "";
  return language === "es" ? copy.es : copy.en;
}

async function fileToJpegDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1280;
  let width = bitmap.width;
  let height = bitmap.height;
  const down = Math.min(1, maxSide / Math.max(width, height));
  width = Math.max(1, Math.round(width * down));
  height = Math.max(1, Math.round(height * down));
  const short = Math.min(width, height);
  if (short < 720) {
    const up = 720 / short;
    width = Math.round(width * up);
    height = Math.round(height * up);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("canvas");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let url = canvas.toDataURL("image/jpeg", 0.85);
  if (url.length > 1_900_000) url = canvas.toDataURL("image/jpeg", 0.65);
  return url;
}

async function canvasImage(blob: Blob) {
  const photo = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    photo.close();
    throw new Error("canvas");
  }
  const scale = Math.max(1080 / photo.width, 1080 / photo.height);
  const w = photo.width * scale;
  const h = photo.height * scale;
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.drawImage(photo, (1080 - w) / 2, (1080 - h) / 2, w, h);
  photo.close();
  return { canvas, ctx };
}

function jpegFile(canvas: HTMLCanvasElement, name: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("canvas"));
      else resolve(new File([blob], name, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  });
}

async function downloadUrl(url: string, name: string) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("download");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = name;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function CreativeStudio({
  language,
  disabled,
  onUseInPost,
}: {
  language: Lang;
  disabled?: boolean;
  onUseInPost: (item: UseItem) => Promise<void>;
}) {
  const L = (es: string, en: string) => (language === "es" ? es : en);
  const [kind, setKind] = useState<CreativeKind>("image");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [referenceName, setReferenceName] = useState("");
  const referenceFile = useRef<File | null>(null);
  const [config, setConfig] = useState<CreativeConfig | null>(null);
  const [gallery, setGallery] = useState<CreativeAsset[]>([]);
  const [result, setResult] = useState<CreativeAsset | null>(null);
  const [source, setSource] = useState<Blob | null>(null);
  const [flyerUrl, setFlyerUrl] = useState("");
  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [contact, setContact] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [copyWarning, setCopyWarning] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const controller = useRef<AbortController | null>(null);
  const editRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => () => {
    if (flyerUrl) URL.revokeObjectURL(flyerUrl);
  }, [flyerUrl]);

  async function loadGallery() {
    const response = await fetch(endpoint, { credentials: "include", cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { gallery?: CreativeAsset[]; config?: CreativeConfig };
    setGallery(Array.isArray(data.gallery) ? data.gallery : []);
    if (data.config) setConfig(data.config);
  }

  useEffect(() => {
    void loadGallery();
  }, []);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  function apiText(data: { message?: string; messageEn?: string }) {
    if (language === "en" && data.messageEn) return data.messageEn;
    return data.message || L("No se pudo crear el archivo.", "Could not create the file.");
  }

  function clearFlyer() {
    setFlyerFile(null);
    setFlyerUrl("");
  }

  function applyAsset(asset: CreativeAsset, warning = "") {
    setResult(asset);
    setCaption(asset.caption || "");
    setHashtags((asset.hashtags || []).join(" "));
    setCopyWarning(warning);
    setPrompt(asset.prompt || "");
    setStyle(asset.style || "");
    setKind(asset.kind);
    if (asset.aspectRatio) setAspectRatio(asset.aspectRatio);
    if (asset.durationSec === 10 || asset.durationSec === 5) setDuration(asset.durationSec);
    setGallery((items) => [asset, ...items.filter((item) => item.id !== asset.id)]);
  }

  function warnText(data: { copyWarning?: { es?: string; en?: string } | null }) {
    const warning = data.copyWarning;
    if (!warning) return "";
    return language === "en" ? warning.en || warning.es || "" : warning.es || "";
  }

  async function rememberImage(asset: CreativeAsset) {
    if (asset.kind !== "image") {
      setSource(null);
      return;
    }
    const response = await fetch(asset.url, { credentials: "include" });
    if (!response.ok) return;
    setSource(await response.blob());
  }

  function openDetail(item: CreativeAsset) {
    applyAsset(item);
    setDetailId(item.id);
    setEditNote("");
    window.setTimeout(() => document.getElementById("detalle-creacion")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }

  async function generate(variation = false, source?: CreativeAsset) {
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    const useKind = source?.kind || kind;
    const usePrompt = (source?.prompt || prompt).trim();
    const useStyle = source ? source.style || "" : style;
    const useAspect = source?.aspectRatio || aspectRatio;
    const useDuration = source?.durationSec === 10 ? 10 : source ? 5 : duration;
    const groupId = variation ? source?.groupId || source?.id || result?.groupId || result?.id : undefined;
    setBusy(true);
    setError("");
    setNotice("");
    if (!variation) {
      setResult(null);
      setCaption("");
      setHashtags("");
      setCopyWarning("");
      setSource(null);
      clearFlyer();
    }
    setPhase(variation
      ? (useKind === "video" ? L("Regenerando video…", "Regenerating video…") : L("Regenerando imagen…", "Regenerating image…"))
      : (useKind === "video" ? L("Enviando el video…", "Submitting the video…") : L("Generando imagen…", "Generating image…")));
    setElapsed(0);
    try {
      if (!usePrompt) {
        setError(L("Escribe un prompt para regenerar esta creación.", "Write a prompt to regenerate this creation."));
        if (source) openDetail(source);
        else if (result) openDetail(result);
        return;
      }
      let photo: string | undefined;
      if (useKind === "video" && referenceFile.current && !source) photo = await fileToJpegDataUrl(referenceFile.current);
      const started = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          kind: useKind,
          prompt: usePrompt,
          style: useStyle,
          aspectRatio: useAspect,
          duration: useDuration,
          photo,
          groupId,
          lang: language,
        }),
      });
      const data = await started.json().catch(() => ({}));
      if (!started.ok || (data.status !== "succeeded" && data.status !== "pending")) {
        setError(apiText(data));
        return;
      }
      if (data.status === "succeeded" && data.asset) {
        applyAsset(data.asset, warnText(data));
        setDetailId(data.asset.id);
        await rememberImage(data.asset);
        await loadGallery();
        window.dispatchEvent(new Event("enone-creative-updated"));
        return;
      }
      if (typeof data.caption === "string") {
        setCaption(data.caption);
        setHashtags(Array.isArray(data.hashtags) ? data.hashtags.join(" ") : "");
        setCopyWarning(warnText(data));
      }
      const job = data.job as string;
      for (let attempt = 0; attempt < 100 && !abort.signal.aborted; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        if (abort.signal.aborted) return;
        const response = await fetch(`${endpoint}?job=${encodeURIComponent(job)}`, {
          credentials: "include",
          cache: "no-store",
          signal: abort.signal,
        });
        const view = await response.json().catch(() => ({}));
        if (response.status === 202) {
          const position = typeof view.queuePosition === "number" ? view.queuePosition : null;
          if (view.phase === "queued") {
            setPhase(L("En cola", "In queue") + (position != null ? ` · ${position + 1}` : ""));
          } else if (view.phase === "saving") {
            setPhase(L("Guardando en la galería…", "Saving to the gallery…"));
          } else {
            setPhase(L("Generando video…", "Generating video…"));
          }
          continue;
        }
        if (!response.ok || view.status === "failed") {
          setError(apiText(view));
          return;
        }
        if (view.asset) {
          applyAsset(view.asset, warnText(view));
          setDetailId(view.asset.id);
          await loadGallery();
          window.dispatchEvent(new Event("enone-creative-updated"));
          return;
        }
        setError(L("No se pudo leer el resultado.", "Could not read the result."));
        return;
      }
      if (!abort.signal.aborted) setError(L("El video no llegó a tiempo. Vuelve a consultar la galería en unos minutos.", "The video did not arrive in time. Check the gallery again in a few minutes."));
    } catch {
      if (!abort.signal.aborted) setError(L("No se pudo crear el archivo. Revisa la clave en Integraciones e inténtalo de nuevo.", "Could not create the file. Check the key in Integrations and try again."));
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  async function renderFlyer() {
    if (!source) return;
    setError("");
    try {
      const { canvas, ctx } = await canvasImage(source);
      if (title || price || contact) {
        const gradient = ctx.createLinearGradient(0, 540, 0, 1080);
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(1, "rgba(0,0,0,0.92)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 540, 1080, 540);
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 72px system-ui, sans-serif";
      ctx.fillText(title, 64, 820, 952);
      ctx.fillStyle = "#fef08a";
      ctx.font = "bold 54px system-ui, sans-serif";
      ctx.fillText(price, 64, 900, 952);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 40px system-ui, sans-serif";
      ctx.fillText(contact, 64, 980, 952);
      if (logo) {
        const bitmap = await createImageBitmap(logo);
        const scale = Math.min(220 / bitmap.width, 120 / bitmap.height);
        ctx.drawImage(bitmap, 64, 64, bitmap.width * scale, bitmap.height * scale);
        bitmap.close();
      }
      const file = await jpegFile(canvas, "enone-flyer.jpg");
      setFlyerFile(file);
      setFlyerUrl(URL.createObjectURL(file));
    } catch {
      setError(L("No se pudo armar el flyer.", "Could not build the flyer."));
    }
  }

  async function persistCopy(asset: CreativeAsset, nextCaption = caption, nextTags = hashtags) {
    const response = await fetch(endpoint, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: asset.id, caption: nextCaption, hashtags: nextTags }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.asset) throw new Error("save");
    setGallery((items) => items.map((item) => (item.id === data.asset.id ? data.asset : item)));
    setResult((current) => (current?.id === data.asset.id ? data.asset : current));
    window.dispatchEvent(new Event("enone-creative-updated"));
    return data.asset as CreativeAsset;
  }

  async function editItem(item: CreativeAsset) {
    if (item.kind !== "image") {
      openDetail(item);
      setError(L("Editar con IA funciona con imágenes. En un video usa Regenerar.", "AI edit works on images. For a video, use Regenerate."));
      return;
    }
    const instruction = editNote.trim();
    if (!instruction) {
      openDetail(item);
      setError(L("Escribe qué quieres cambiar, por ejemplo: cambia el fondo.", "Describe the change, for example: change the background."));
      window.setTimeout(() => editRef.current?.focus(), 60);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    setPhase(L("Editando la imagen…", "Editing the image…"));
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", id: item.id, instruction, lang: language }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.asset) {
        setError(apiText(data));
        return;
      }
      applyAsset(data.asset, warnText(data));
      setDetailId(data.asset.id);
      setEditNote("");
      await rememberImage(data.asset);
      await loadGallery();
      window.dispatchEvent(new Event("enone-creative-updated"));
    } catch {
      setError(L("No se pudo editar la imagen.", "Could not edit the image."));
    } finally {
      setBusy(false);
    }
  }

  async function regenCopy(target?: CreativeAsset) {
    const asset = target || result;
    if (!asset) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copy", id: asset.id, lang: language }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.asset) {
        setError(apiText(data));
        return;
      }
      applyAsset(data.asset, warnText(data));
      window.dispatchEvent(new Event("enone-creative-updated"));
    } catch {
      setError(L("No se pudo regenerar el texto.", "Could not regenerate the text."));
    } finally {
      setBusy(false);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(L("Copiado.", "Copied."));
    } catch {
      setError(L("No se pudo copiar.", "Could not copy."));
    }
  }

  async function attachItem(item: UseItem) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      let next = item;
      if (item.asset && item.asset.id === result?.id) {
        const saved = await persistCopy(item.asset);
        next = { ...item, asset: saved };
      }
      await onUseInPost(next);
      setNotice(L("Quedó en el compositor de la publicación.", "Added to the post composer."));
    } catch {
      setError(L("No se pudo adjuntar a la publicación.", "Could not attach it to the post."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(L("¿Quitar esta creación de la galería?", "Remove this creation from the gallery?"))) return;
    const response = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) {
      setError(L("No se pudo borrar.", "Could not delete it."));
      return;
    }
    const rest = gallery.filter((item) => item.id !== id);
    setGallery(rest);
    if (result?.id === id) {
      const sibling = rest.find((item) => item.groupId && item.groupId === result.groupId);
      if (sibling) {
        applyAsset(sibling);
        void rememberImage(sibling);
      } else {
        setResult(null);
        setCaption("");
        setHashtags("");
      }
    }
  }

  const aspects = kind === "image" ? IMAGE_ASPECTS : VIDEO_ASPECTS;
  const previewUrl = flyerUrl || result?.url || "";
  const imageMissing = config && !config.image && kind === "image";
  const videoMissing = config && !config.video && kind === "video";
  const variations = result ? gallery.filter((item) => item.groupId && item.groupId === result.groupId) : [];
  const hashtagList = parseHashtags(hashtags);

  return (
    <section id="estudio-creativo" aria-label={L("Estudio creativo", "Creative studio")} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-[var(--brand)]" />
            {L("Estudio creativo", "Creative studio")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {L(
              "Escribe un prompt y genera imágenes o videos cortos. Se guardan en la galería y puedes usarlos en la publicación.",
              "Write a prompt and generate images or short videos. They are saved in the gallery and can be used in a post."
            )}
          </p>
        </div>
        <Link href="/dashboard/integrations" className="text-xs font-semibold text-[var(--brand)] hover:underline">
          {L("Claves en Integraciones", "Keys in Integrations")}
        </Link>
      </div>

      {config?.messages.mock && (
        <p className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">{pick(language, config.messages.mock)}</p>
      )}
      {imageMissing && (
        <p role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {pick(language, config?.messages.image)}
        </p>
      )}
      {videoMissing && (
        <p role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {pick(language, config?.messages.video)}
        </p>
      )}
      {config?.messages.copy && (
        <p role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {pick(language, config.messages.copy)}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {L("Tipo", "Type")}
            <select
              className={input}
              value={kind}
              disabled={disabled || busy}
              onChange={(event) => {
                const next = event.target.value === "video" ? "video" : "image";
                setKind(next);
                setAspectRatio(next === "video" ? "9:16" : "1:1");
                setError("");
              }}
            >
              <option value="image">{L("Imagen", "Image")}</option>
              <option value="video">{L("Video", "Video")}</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {L("Prompt", "Prompt")}
            <textarea
              className={input}
              rows={4}
              maxLength={2000}
              disabled={disabled || busy}
              value={prompt}
              placeholder={L("Un café de especialidad en una mesa de madera, luz de mañana, estilo anuncio", "A specialty coffee on a wooden table, morning light, ad style")}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {L("Estilo", "Style")}
              <select className={input} value={style} disabled={disabled || busy} onChange={(event) => setStyle(event.target.value)}>
                {STYLES.map((item) => (
                  <option key={item.id || "none"} value={item.id}>
                    {language === "es" ? item.es : item.en}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {L("Formato", "Aspect ratio")}
              <select className={input} value={aspectRatio} disabled={disabled || busy || (kind === "video" && !!referenceName)} onChange={(event) => setAspectRatio(event.target.value)}>
                {aspects.map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {ratio}
                    {ratio === "9:16" ? L(" · vertical", " · vertical") : ratio === "16:9" ? L(" · horizontal", " · landscape") : ratio === "4:5" || ratio === "3:4" ? L(" · feed", " · feed") : L(" · cuadrado", " · square")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {kind === "video" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {L("Duración", "Duration")}
                <select className={input} value={duration} disabled={disabled || busy} onChange={(event) => setDuration(event.target.value === "10" ? 10 : 5)}>
                  <option value={5}>{L("5 segundos", "5 seconds")}</option>
                  <option value={10}>{L("10 segundos", "10 seconds")}</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {L("Imagen de referencia (opcional)", "Reference image (optional)")}
                <span className={`${input} flex cursor-pointer items-center gap-2`}>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{L("Elegir archivo", "Choose file")}</span>
                  <span className="truncate text-slate-600">{referenceName || L("Ningún archivo", "No file")}</span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={disabled || busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      referenceFile.current = file;
                      setReferenceName(file?.name || "");
                    }}
                  />
                </span>
              </label>
            </div>
          )}
          {kind === "video" && referenceName && (
            <p className="text-xs text-slate-500">
              {L("Video desde imagen. El encuadre sale de la foto.", "Image-to-video. The frame comes from the photo.")} {referenceName}
            </p>
          )}
          <button
            type="button"
            disabled={disabled || busy || !prompt.trim()}
            onClick={() => void generate()}
            className="brand-bg inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {kind === "image" ? L("Generar imagen", "Generate image") : L("Generar video", "Generate video")}
          </button>
          {result && (
            <button
              type="button"
              disabled={disabled || busy || !prompt.trim()}
              onClick={() => void generate(true)}
              className="inline-flex min-h-[40px] items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-40"
            >
              {kind === "image" ? L("Regenerar imagen", "Regenerate image") : L("Regenerar video", "Regenerate video")}
            </button>
          )}
          {result && (
            <p className="text-xs text-slate-500">
              {L("Puedes cambiar el prompt y regenerar. La versión anterior se queda hasta que la quites.", "You can tweak the prompt and regenerate. The previous version stays until you remove it.")}
            </p>
          )}
          {busy && (
            <p role="status" className="text-sm text-slate-600">
              {phase} {elapsed > 0 ? `· ${elapsed}s` : ""}
            </p>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
        </div>

        <div className="space-y-3">
          <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-200 bg-slate-50">
            {previewUrl && result?.kind === "video" && !flyerUrl ? (
              <video src={previewUrl} controls playsInline className="max-h-96 w-full bg-black" />
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={L("Vista previa generada", "Generated preview")} className="max-h-96 w-full object-contain" />
            ) : (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                {kind === "video" ? <Film className="mx-auto mb-2 h-6 w-6" /> : <ImageIcon className="mx-auto mb-2 h-6 w-6" />}
                {L("La vista previa aparece aquí.", "The preview shows up here.")}
              </div>
            )}
          </div>
          {result && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => void downloadUrl(flyerUrl || result.url, flyerFile?.name || result.name).catch(() => setError(L("No se pudo descargar.", "Could not download.")))}>
                <Download className="h-4 w-4" />
                {L("Descargar", "Download")}
              </button>
              <button type="button" disabled={disabled || busy} className="brand-bg rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={() => void attachItem(flyerFile ? { file: flyerFile, asset: { ...result, caption, hashtags: hashtagList } } : { asset: result })}>
                {L("Usar en la publicación", "Use in post")}
              </button>
            </div>
          )}
          {variations.length > 1 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{L("Variaciones", "Variations")}</p>
              <div className="flex gap-2 overflow-x-auto">
                {variations.map((item) => (
                  <div key={item.id} className={`w-20 shrink-0 overflow-hidden rounded-md border ${item.id === result?.id ? "border-[var(--brand)]" : "border-slate-200"}`}>
                    <button type="button" className="block w-full" onClick={() => { applyAsset(item); void rememberImage(item); }}>
                      {item.kind === "video" ? (
                        <video src={item.url} muted playsInline className="h-16 w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt="" className="h-16 w-full object-cover" />
                      )}
                    </button>
                    <button type="button" className="w-full px-1 py-1 text-[10px] font-semibold text-red-700" onClick={() => void remove(item.id)}>
                      {L("Quitar", "Remove")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{L("Texto viral", "Viral caption")}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} className="text-xs font-semibold text-[var(--brand)] disabled:opacity-40" onClick={() => void regenCopy()}>
                    {L("Regenerar texto", "Regenerate text")}
                  </button>
                  <button type="button" className="text-xs font-semibold text-slate-600" onClick={() => void copyText(caption)}>
                    {L("Copiar texto", "Copy text")}
                  </button>
                  <button type="button" className="text-xs font-semibold text-slate-600" onClick={() => void copyText(hashtagList.join(" "))}>
                    {L("Copiar hashtags", "Copy hashtags")}
                  </button>
                </div>
              </div>
              {copyWarning && <p role="alert" className="text-sm text-amber-800">{copyWarning}</p>}
              <textarea className={input} rows={5} maxLength={1800} value={caption} onChange={(event) => setCaption(event.target.value)} onBlur={() => { if (result) void persistCopy(result).catch(() => setError(L("No se pudo guardar el texto.", "Could not save the text."))); }} />
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Hashtags
                <input className={input} value={hashtags} onChange={(event) => setHashtags(event.target.value)} onBlur={() => { if (result) void persistCopy(result).catch(() => setError(L("No se pudo guardar el texto.", "Could not save the text."))); }} />
              </label>
            </div>
          )}
          {kind === "image" && source && (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{L("Texto del anuncio (opcional)", "Ad text (optional)")}</p>
              <input className={input} maxLength={70} placeholder={L("Título", "Title")} value={title} onChange={(event) => setTitle(event.target.value)} />
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={input} maxLength={45} placeholder={L("Precio u oferta", "Price or offer")} value={price} onChange={(event) => setPrice(event.target.value)} />
                <input className={input} maxLength={50} placeholder="WhatsApp" value={contact} onChange={(event) => setContact(event.target.value)} />
              </div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {L("Logo", "Logo")}
                <span className={`${input} flex cursor-pointer items-center gap-2`}>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold normal-case text-slate-700">{L("Elegir archivo", "Choose file")}</span>
                  <span className="truncate text-sm font-normal normal-case text-slate-600">{logo?.name || L("Ningún archivo", "No file")}</span>
                  <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setLogo(event.target.files?.[0] || null)} />
                </span>
              </label>
              <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => void renderFlyer()}>
                {L("Poner texto en la imagen", "Place text on the image")}
              </button>
            </div>
          )}
        </div>
      </div>

      {detailId && result && (
        <section id="detalle-creacion" className="mt-6 space-y-3 rounded-xl border border-[var(--brand)]/40 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{L("Editar esta creación", "Edit this creation")}</h3>
            <button type="button" className="text-xs font-semibold text-slate-500 underline" onClick={() => setDetailId(null)}>
              {L("Cerrar", "Close")}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {L("Cambia el prompt de arriba y pulsa Regenerar, o describe un cambio para Editar con IA. La versión original se queda en la galería.", "Change the prompt above and press Regenerate, or describe a change for AI edit. The original stays in the gallery.")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={disabled || busy || !prompt.trim()} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-40" onClick={() => void generate(true)}>
              {result.kind === "image" ? L("Regenerar", "Regenerate") : L("Regenerar video", "Regenerate video")}
            </button>
            <button type="button" disabled={disabled || busy || result.kind !== "image"} className="rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={() => void editItem(result)}>
              {L("Editar con IA", "Edit with AI")}
            </button>
            <button type="button" disabled={disabled || busy} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-40" onClick={() => void regenCopy()}>
              {L("Regenerar texto", "Regenerate text")}
            </button>
          </div>
          {result.kind === "video" && (
            <p className="text-xs text-slate-500">{L("Editar con IA está disponible para imágenes. En video usa Regenerar.", "AI edit is available for images. For video, use Regenerate.")}</p>
          )}
          {result.kind === "image" && (
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {L("Qué quieres cambiar", "What to change")}
              <textarea
                ref={editRef}
                className={input}
                rows={2}
                maxLength={800}
                value={editNote}
                placeholder={L("cambia el fondo, pon más luz, quita el texto…", "change the background, add light, remove the text…")}
                onChange={(event) => setEditNote(event.target.value)}
              />
            </label>
          )}
        </section>
      )}

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">{L("Galería", "Gallery")}</h3>
        {gallery.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
            {L("Todavía no hay creaciones guardadas.", "No saved creations yet.")}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.map((item) => (
              <li key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <div role="button" tabIndex={0} className="relative block aspect-square w-full cursor-pointer bg-slate-100" onClick={() => openDetail(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDetail(item); } }}>
                  {item.kind === "video" ? (
                    <video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.prompt} className="h-full w-full object-cover" />
                  )}
                  {item.provider === "mock" && (
                    <span className="absolute left-1 top-1 rounded bg-indigo-600/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                      {L("demo", "demo")}
                    </span>
                  )}
                </div>
                <div className="space-y-2 p-2">
                  <p className="line-clamp-2 text-[11px] text-slate-600">{item.prompt || L("Sin prompt", "No prompt")}</p>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" disabled={disabled || busy || !item.prompt?.trim()} className="rounded bg-[var(--brand)] px-1.5 py-1 text-[10px] font-semibold text-white disabled:opacity-40" onClick={() => void generate(true, item)}>
                      {L("Regenerar", "Regenerate")}
                    </button>
                    <button type="button" disabled={disabled || busy} className="rounded border border-slate-900 px-1.5 py-1 text-[10px] font-semibold text-slate-900 disabled:opacity-40" onClick={() => { openDetail(item); if (item.kind === "image") window.setTimeout(() => editRef.current?.focus(), 80); }}>
                      {L("Editar con IA", "Edit with AI")}
                    </button>
                    <button type="button" disabled={disabled || busy} className="rounded border border-slate-200 px-1.5 py-1 text-[10px] font-semibold text-slate-700 disabled:opacity-40" onClick={() => { openDetail(item); void regenCopy(item); }}>
                      {L("Regenerar texto", "Regenerate text")}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className="rounded border border-slate-200 px-1.5 py-1 text-[10px] font-semibold text-slate-600" onClick={() => void downloadUrl(item.url, item.name).catch(() => setError(L("No se pudo descargar.", "Could not download.")))}>
                      {L("Descargar", "Download")}
                    </button>
                    <button type="button" disabled={disabled || busy} className="rounded bg-slate-900 px-1.5 py-1 text-[10px] font-semibold text-white disabled:opacity-40" onClick={() => void attachItem({ asset: item })}>
                      {L("Usar", "Use")}
                    </button>
                    <button type="button" className="rounded border border-slate-200 p-1 text-slate-500" aria-label={L("Eliminar", "Delete")} onClick={() => void remove(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
