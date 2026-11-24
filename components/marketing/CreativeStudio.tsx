"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/types";

const endpoint = "/api/marketing/creative";
const input = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm";
const action = "rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

async function canvasImage(blob: Blob, size: number, height = size) {
  const photo = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    photo.close();
    throw new Error("canvas");
  }
  const scale = Math.max(size / photo.width, height / photo.height);
  const w = photo.width * scale;
  const h = photo.height * scale;
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, size, height);
  ctx.drawImage(photo, (size - w) / 2, (height - h) / 2, w, h);
  photo.close();
  return { canvas, ctx };
}

function jpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("canvas")), "image/jpeg", 0.92);
  });
}

export function CreativeStudio({ language, disabled, onAttach }: {
  language: Lang;
  disabled?: boolean;
  onAttach: (file: File) => Promise<void>;
}) {
  const L = (es: string, en: string) => language === "es" ? es : en;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [contact, setContact] = useState("");
  const [background, setBackground] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  function show(blob: Blob, name: string) {
    const file = new File([blob], name, { type: blob.type });
    setPreview({ file, url: URL.createObjectURL(file) });
  }

  async function renderFlyer(source: Blob) {
    const { canvas, ctx } = await canvasImage(source, 1080);
    const gradient = ctx.createLinearGradient(0, 540, 0, 1080);
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(1, "rgba(0,0,0,0.92)");
    if (title || price || contact) {
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 540, 1080, 540);
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 84px system-ui";
    ctx.fillText(title, 64, 824, 952);
    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 62px system-ui";
    ctx.fillText(price, 64, 918, 952);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px system-ui";
    ctx.fillText(contact, 64, 1004, 952);
    if (logo) {
      const bitmap = await createImageBitmap(logo);
      const scale = Math.min(220 / bitmap.width, 120 / bitmap.height);
      ctx.drawImage(bitmap, 64, 64, bitmap.width * scale, bitmap.height * scale);
      bitmap.close();
    }
    show(await jpeg(canvas), "enone-flyer.jpg");
  }

  async function generate(usePhoto = false) {
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      if (kind === "image" && usePhoto) {
        const source = background ?? photo;
        if (!source) return;
        await renderFlyer(source);
        return;
      }

      let photoData: string | undefined;
      if (kind === "video" && photo) {
        const { canvas } = await canvasImage(photo, 720, 1280);
        photoData = canvas.toDataURL("image/jpeg", 0.85);
      }
      const started = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, prompt, photo: photoData }),
        signal: abort.signal,
      });
      const result = await started.json();
      if (result.error === "not_enabled") {
        setError(L("La generación con IA todavía no está habilitada para esta cuenta.", "AI generation is not enabled for this account yet."));
        return;
      }
      if (!started.ok || typeof result.job !== "string") throw new Error("generation");

      for (let attempt = 0; attempt < 72 && !abort.signal.aborted; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        if (abort.signal.aborted) return;
        const response = await fetch(`${endpoint}?job=${encodeURIComponent(result.job)}`, {
          signal: abort.signal,
          cache: "no-store",
        });
        if (response.status === 202) continue;
        if (!response.ok) throw new Error("generation");

        const blob = await response.blob();
        if (kind === "image") {
          setBackground(blob);
          await renderFlyer(blob);
        } else {
          show(blob, "enone-video.mp4");
        }
        return;
      }
      if (!abort.signal.aborted) setError(L("No llegó el resultado a tiempo.", "The result did not arrive in time."));
    } catch {
      if (!abort.signal.aborted) setError(L("No se pudo crear el anuncio. Revisa la imagen y la configuración antes de volver a intentarlo.", "Could not create the ad. Check the image and configuration before retrying."));
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  function invalidatePreview() {
    setPreview(null);
    setError("");
  }

  if (!open) return (
    <button type="button" disabled={disabled} className={action} onClick={() => setOpen(true)}>
      {L("Crear anuncio", "Create ad")}
    </button>
  );

  return (
    <section aria-label={L("Crear anuncio", "Create ad")} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{L("Crear anuncio", "Create ad")}</h3>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="text-sm underline disabled:opacity-50">
          {L("Cerrar", "Close")}
        </button>
      </div>
      <fieldset disabled={disabled || busy} className="grid gap-3">
        <label className="text-sm">
          {L("Formato", "Format")}
          <select className={input} value={kind} onChange={(event) => {
            setKind(event.target.value === "video" ? "video" : "image");
            invalidatePreview();
          }}>
            <option value="image">{L("Flyer cuadrado", "Square flyer")}</option>
            <option value="video">{L("Video vertical · 5 segundos", "Vertical video · 5 seconds")}</option>
          </select>
        </label>
        <label className="text-sm">
          {kind === "image" ? L("Describe la imagen para tu oferta", "Describe the image for your offer") : L("Describe cómo se debe mover la escena", "Describe how the scene should move")}
          <textarea className={input} rows={2} maxLength={800} value={prompt} onChange={(event) => {
            setPrompt(event.target.value);
            setBackground(null);
            invalidatePreview();
          }} />
        </label>
        <label className="text-sm">
          {kind === "image" ? L("Foto propia para el flyer", "Your own photo for the flyer") : L("Foto inicial del video (se envía a Runway)", "Video starting photo (sent to Runway)")}
          <input className={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
            setPhoto(event.target.files?.[0] ?? null);
            setBackground(null);
            invalidatePreview();
          }} />
        </label>
        {kind === "image" && (
          <>
            <label className="text-sm">{L("Título", "Title")}
              <input className={input} maxLength={70} value={title} onChange={(event) => { setTitle(event.target.value); invalidatePreview(); }} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">{L("Precio u oferta", "Price or offer")}
                <input className={input} maxLength={45} value={price} onChange={(event) => { setPrice(event.target.value); invalidatePreview(); }} />
              </label>
              <label className="text-sm">WhatsApp
                <input className={input} maxLength={50} value={contact} onChange={(event) => { setContact(event.target.value); invalidatePreview(); }} />
              </label>
            </div>
            <label className="text-sm">Logo
              <input className={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                setLogo(event.target.files?.[0] ?? null);
                invalidatePreview();
              }} />
            </label>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          {kind === "image" && (photo || background) && (
            <button type="button" className={action} onClick={() => void generate(true)}>
              {L("Actualizar flyer", "Render flyer")}
            </button>
          )}
          <button type="button" className={action} disabled={!prompt.trim() || (kind === "video" && !photo)} onClick={() => void generate()}>
            {L("Generar con IA", "Generate with AI")}
          </button>
        </div>
      </fieldset>
      {busy && <p role="status" className="text-sm">{L("Procesando anuncio…", "Processing ad…")}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {preview && (
        <div className="space-y-3">
          {preview.file.type.startsWith("video/") ? (
            <video src={preview.url} controls playsInline className="max-h-96 max-w-full rounded-lg" />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={preview.url} alt={L("Vista previa del flyer", "Flyer preview")} className="max-h-96 max-w-full rounded-lg" />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <a href={preview.url} download={preview.file.name} className="text-sm underline">{L("Descargar", "Download")}</a>
            <button type="button" disabled={disabled || busy} className={action} onClick={() => {
              setBusy(true);
              void onAttach(preview.file).then(() => {
                setPreview(null);
                setOpen(false);
              }).catch(() => {
                setError(L("No se pudo adjuntar el archivo.", "Could not attach the file."));
              }).finally(() => setBusy(false));
            }}>{L("Adjuntar al anuncio", "Attach to post")}</button>
          </div>
        </div>
      )}
    </section>
  );
}
