"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { postText } from "@/lib/creative/copy";
import { serviceLabel } from "@/lib/buffer/model";
import type { BufferChannelInfo, Lang } from "@/lib/types";

export type BufferSendAsset = {
  id: string;
  url: string;
  kind: "image" | "video";
  name: string;
  caption?: string;
  hashtags?: string[];
};

type Status = {
  connected: boolean;
  channels: BufferChannelInfo[];
  channelIds: string[];
  error?: string;
};

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function SendToBufferDialog({
  asset,
  language,
  onClose,
  onUpdated,
}: {
  asset: BufferSendAsset | null;
  language: Lang;
  onClose: () => void;
  onUpdated?: (asset: BufferSendAsset & { caption: string; hashtags: string[] }) => void;
}) {
  const es = language !== "en";
  const L = (a: string, b: string) => (es ? a : b);
  const [status, setStatus] = useState<Status | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"queue" | "now" | "custom">("queue");
  const [igType, setIgType] = useState<"post" | "story" | "reel">("post");
  const [tiktokTitle, setTiktokTitle] = useState("");
  const [when, setWhen] = useState("");
  const [daily, setDaily] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "loading" | "generating" | "ready">("idle");
  const [copyError, setCopyError] = useState("");

  async function loadCopy(id: string, regenerate: boolean) {
    setCopyError("");
    setCopyState(regenerate ? "generating" : "loading");
    const saved = await fetch(`/api/marketing/creative?id=${encodeURIComponent(id)}`, { credentials: "include", cache: "no-store" });
    const savedBody = await saved.json().catch(() => ({}));
    let caption = String(savedBody.asset?.caption || "");
    let hashtags: string[] = Array.isArray(savedBody.asset?.hashtags) ? savedBody.asset.hashtags : [];
    const empty = !postText(caption, hashtags).trim();
    if (regenerate || empty) {
      setCopyState("generating");
      const generated = await fetch("/api/marketing/creative", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copy", id, lang: language === "en" ? "en" : "es" }),
      });
      const body = await generated.json().catch(() => ({}));
      if (!generated.ok || !body.asset) {
        setCopyState("ready");
        setCopyError(body.message || (language === "en" ? "Could not write the caption." : "No se pudo escribir el texto."));
        if (!regenerate && postText(caption, hashtags)) setText(postText(caption, hashtags));
        return;
      }
      caption = String(body.asset.caption || "");
      hashtags = Array.isArray(body.asset.hashtags) ? body.asset.hashtags : [];
      onUpdated?.({ ...body.asset, caption, hashtags });
    }
    const draft = postText(caption, hashtags);
    setText(draft);
    setTiktokTitle((draft.split("\n").map((part) => part.trim()).find(Boolean) || "").slice(0, 90));
    setCopyState("ready");
  }

  useEffect(() => {
    if (!asset) return;
    setText(postText(asset.caption, asset.hashtags));
    setIgType(asset.kind === "video" ? "reel" : "post");
    setMode("queue");
    setWhen("");
    setDaily(false);
    setMessage("");
    setError("");
    setCopyError("");
    let cancel = false;
    void loadCopy(asset.id, false).catch(() => {
      if (!cancel) {
        setCopyState("ready");
        setCopyError(language === "en" ? "Could not load the caption." : "No se pudo cargar el texto.");
      }
    });
    void fetch("/api/buffer/status", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancel) return;
        if (!res.ok) {
          setStatus({ connected: false, channels: [], channelIds: [], error: data.error });
          return;
        }
        setStatus(data);
        setChannels(Array.isArray(data.channelIds) && data.channelIds.length ? data.channelIds : (data.channels || []).filter((c: BufferChannelInfo) => !c.isLocked && !c.isDisconnected).map((c: BufferChannelInfo) => c.id));
      })
      .catch(() => {
        if (!cancel) setStatus({ connected: false, channels: [], channelIds: [] });
      });
    return () => {
      cancel = true;
    };
    // Reload copy only when a different creation is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id]);

  if (!asset) return null;
  const connected = Boolean(status?.connected);
  const list = status?.channels || [];

  async function submit() {
    if (!connected) return;
    if (!channels.length) {
      setError(L("Elige al menos un canal de Buffer.", "Choose at least one Buffer channel."));
      return;
    }
    if (mode === "custom" && !when) {
      setError(L("Elige fecha y hora.", "Pick a date and time."));
      return;
    }
    if (!text.trim()) {
      setError(L("Escribe el texto de la publicación.", "Write the post text."));
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/buffer/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          media: [{ url: asset!.url, kind: asset!.kind, name: asset!.name }],
          channelIds: channels,
          mode,
          instagramType: igType,
          tiktokTitle: tiktokTitle.trim(),
          dueAt: mode === "custom" ? new Date(when).toISOString() : null,
          addToDaily: daily,
          creativeId: asset!.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.pinned) {
        setError(data.error || L("No se pudo enviar a Buffer.", "Could not send to Buffer."));
        return;
      }
      const bits = [];
      if (data.ok) {
        bits.push(mode === "now" ? L("Buffer publicará esta pieza ahora.", "Buffer will publish this now.") : mode === "custom" ? L("Programada en Buffer.", "Scheduled in Buffer.") : L("Agregada a la cola de Buffer.", "Added to the Buffer queue."));
      } else if (data.error) {
        bits.push(data.error);
      }
      if (data.pinned) bits.push(L("También quedó en la programación diaria.", "Also added to the daily schedule."));
      setMessage(bits.join(" "));
      window.dispatchEvent(new Event("enone-buffer-updated"));
    } catch {
      setError(L("No se pudo enviar a Buffer.", "Could not send to Buffer."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="enviar-buffer-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="enviar-buffer-title" className="text-base font-semibold text-slate-900">
              {L("Enviar a Buffer", "Send to Buffer")}
            </h2>
            <p className="text-xs text-slate-500">{asset.name}</p>
          </div>
          <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label={L("Cerrar", "Close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {!status && <p className="text-sm text-slate-500">{L("Cargando canales…", "Loading channels…")}</p>}

        {status && !connected && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <p>
              {status.error ||
                L(
                  "Buffer no está conectado. En Integraciones → Buffer pega tu clave de API (Buffer → Ajustes → API) y pulsa Guardar y conectar.",
                  "Buffer is not connected. In Integrations → Buffer paste your API key (Buffer → Settings → API) and press Save and connect."
                )}
            </p>
            <Link href="/dashboard/integrations#buffer" className="mt-2 inline-block font-semibold underline">
              {L("Ir a Integraciones → Buffer", "Go to Integrations → Buffer")}
            </Link>
          </div>
        )}

        {connected && (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{L("Canales", "Channels")}</p>
              <div className="flex flex-wrap gap-2">
                {list.map((channel) => {
                  const on = channels.includes(channel.id);
                  const blocked = channel.isLocked || channel.isDisconnected;
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      disabled={blocked || busy}
                      onClick={() => setChannels((prev) => (prev.includes(channel.id) ? prev.filter((id) => id !== channel.id) : [...prev, channel.id]))}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-40 ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700"}`}
                    >
                      {serviceLabel(channel.service)} · {channel.displayName || channel.name}
                    </button>
                  );
                })}
              </div>
              {list.length === 0 && (
                <p className="text-sm text-amber-800">{L("No hay canales. Actualízalos en Integraciones → Buffer.", "No channels. Refresh them in Integrations → Buffer.")}</p>
              )}
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{L("Texto y hashtags", "Caption and hashtags")}</p>
                <button type="button" className="text-xs font-semibold text-[var(--brand)] disabled:opacity-40" disabled={copyState === "generating" || copyState === "loading"} onClick={() => void loadCopy(asset.id, true)}>
                  {L("Generar/Regenerar texto", "Generate/regenerate text")}
                </button>
              </div>
              {(copyState === "loading" || copyState === "generating") && (
                <p className="mb-1 flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copyState === "generating" ? L("Escribiendo el texto viral y los hashtags…", "Writing the viral caption and hashtags…") : L("Cargando el texto guardado…", "Loading the saved caption…")}
                </p>
              )}
              {copyError && (
                <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <p>{copyError}</p>
                  <Link href="/dashboard/integrations#claves-creativas" className="mt-1 inline-block font-semibold underline">
                    {L("Ir a Integraciones → Estudio creativo", "Go to Integrations → Creative studio")}
                  </Link>
                </div>
              )}
              <textarea className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800" rows={6} maxLength={5000} value={text} onChange={(event) => setText(event.target.value)} />
              <p className="mt-1 text-[11px] text-slate-500">{L("Se envía la caption, una línea en blanco y los hashtags.", "The caption, a blank line, and the hashtags are sent together.")}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {([
                ["queue", L("Agregar a la cola", "Add to queue")],
                ["now", L("Publicar ahora", "Post now")],
                ["custom", L("Programar", "Schedule")],
              ] as const).map(([id, label]) => (
                <label key={id} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 ${mode === id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200"}`}>
                  <input className="sr-only" type="radio" name="buffer-mode" checked={mode === id} onChange={() => setMode(id)} />
                  {label}
                </label>
              ))}
            </div>
            {list.some((channel) => channels.includes(channel.id) && channel.service.toLowerCase() === "instagram") && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{L("Tipo en Instagram", "Instagram type")}</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  {([
                    ["post", "Post"],
                    ["story", L("Historia", "Story")],
                    ["reel", "Reel"],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setIgType(id)}
                      className={`rounded-full border px-3 py-1 ${igType === id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {L("Un video suelto se publica como Reel. Historia no va al feed.", "A single video is published as a Reel. Stories are not shared to the feed.")}
                </p>
              </div>
            )}
            {list.some((channel) => channels.includes(channel.id) && channel.service.toLowerCase() === "tiktok") && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{L("TikTok", "TikTok")}</p>
                {asset.kind === "video" ? (
                  <p className="text-xs text-slate-600">
                    {L("Se envía como video. El texto no puede pasar de 2200 caracteres; si se pasa, se recorta.", "Sent as a video. The caption cannot pass 2,200 characters; extra text is trimmed.")}
                  </p>
                ) : (
                  <>
                    <p className="mb-1 text-xs text-slate-600">
                      {L("Una imagen se publica como foto de TikTok. Varias imágenes van en carrusel. El texto puede tener hasta 4000 caracteres.", "An image is published as a TikTok photo. Several images become a carousel. The caption can be up to 4,000 characters.")}
                    </p>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {L("Título de la foto", "Photo title")}
                      <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case" maxLength={90} value={tiktokTitle} onChange={(event) => setTiktokTitle(event.target.value.slice(0, 90))} />
                    </label>
                  </>
                )}
                {text.length > (asset.kind === "video" ? 2200 : 4000) && (
                  <p className="mt-1 text-xs text-amber-800">
                    {L("El texto supera el límite de TikTok y se recortará al enviar.", "The text is over TikTok's limit and will be trimmed when sent.")}
                  </p>
                )}
              </div>
            )}
            {mode === "custom" && (
              <input type="datetime-local" className="rounded-md border border-slate-200 px-2 py-2 text-sm" min={toLocalInput(new Date())} value={when} onChange={(event) => setWhen(event.target.value)} />
            )}
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" className="mt-1" checked={daily} onChange={(event) => setDaily(event.target.checked)} />
              <span>{L("Agregar a la programación diaria (se enviará otra vez en el próximo horario guardado).", "Add to the daily schedule (it will be sent again at the next saved time).")}</span>
            </label>
            {!asset.url.startsWith("https://") && (
              <p className="text-xs text-amber-800">
                {L(
                  "Esta imagen todavía no está en una URL pública. Con Blob se envía directo; sin Blob, Buffer real no puede descargarla.",
                  "This image is not on a public URL yet. With Blob it sends directly; without Blob, real Buffer cannot fetch it."
                )}
              </p>
            )}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {message && (
              <p role="status" className="text-sm text-emerald-700">
                {message}{" "}
                <a href="#buffer" className="font-semibold underline" onClick={onClose}>
                  {L("Ver historial", "View history")}
                </a>
              </p>
            )}
            <button type="button" disabled={busy} onClick={() => void submit()} className="brand-bg inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {L("Enviar a Buffer", "Send to Buffer")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
