"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { MediaPicker } from "@/components/marketing/MediaPicker";
import { serviceLabel } from "@/lib/buffer/model";
import { postText } from "@/lib/creative/copy";
import { ensureCloudMedia } from "@/lib/mediaCloud";
import type { BufferChannelInfo } from "@/lib/types";
import { useStore } from "@/store/useStore";

type Status = {
  connected: boolean;
  accountEmail: string;
  organizationName: string;
  channelIds: string[];
  channels: BufferChannelInfo[];
  error?: string;
};

type Log = {
  id: string;
  at: string;
  source: "manual" | "daily";
  channelName: string;
  service: string;
  text: string;
  mode: string;
  dueAt: string | null;
  ok: boolean;
  error: string | null;
  warning: string | null;
};

type Schedule = {
  enabled: boolean;
  times: string[];
  timezone: string;
  channelIds: string[];
  mode: "queue" | "fixed";
  source: "drafts" | "gallery" | "both";
  aiCaptions: boolean;
  aiBrief: string;
};

type StudioItem = {
  id: string;
  kind: "image" | "video";
  name: string;
  url: string;
  mime: string;
  text: string;
};

const ZONES = [
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Argentina/Buenos_Aires",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/Madrid",
  "UTC",
];

function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City";
  } catch {
    return "America/Mexico_City";
  }
}

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function BufferPanel() {
  const language = useStore((s) => s.settings.language);
  const showToast = useStore((s) => s.showToast);
  const mediaAssets = useStore((s) => s.mediaAssets);
  const setMediaCloud = useStore((s) => s.setMediaCloud);
  const userId = useStore((s) => s.session?.userId || "");
  const es = language === "es";
  const L = useCallback((a: string, b: string) => (es ? a : b), [es]);

  const [status, setStatus] = useState<Status | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [text, setText] = useState("");
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [studio, setStudio] = useState<StudioItem[]>([]);
  const [studioIds, setStudioIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [mode, setMode] = useState<"queue" | "custom" | "now">("queue");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [schedule, setSchedule] = useState<Schedule>({
    enabled: false,
    times: ["09:00"],
    timezone: browserZone(),
    channelIds: [],
    mode: "queue",
    source: "both",
    aiCaptions: false,
    aiBrief: "",
  });
  const [saving, setSaving] = useState(false);

  const mediaById = useMemo(() => new Map(mediaAssets.map((m) => [m.id, m])), [mediaAssets]);
  const zones = useMemo(() => {
    const z = browserZone();
    return ZONES.includes(z) ? ZONES : [z, ...ZONES];
  }, []);

  const load = useCallback(async () => {
    const [st, sch] = await Promise.all([
      fetch("/api/buffer/status", { credentials: "include", cache: "no-store" }),
      fetch("/api/buffer/schedule", { credentials: "include", cache: "no-store" }),
    ]);
    if (st.ok) {
      const data = (await st.json()) as Status;
      setStatus(data);
      setChannels((prev) => (prev.length ? prev : data.channelIds || []));
    } else {
      const data = await st.json().catch(() => ({}));
      setStatus({ connected: false, accountEmail: "", organizationName: "", channelIds: [], channels: [], error: data.error });
    }
    const studioRes = await fetch("/api/marketing/creative", { credentials: "include", cache: "no-store" });
    if (studioRes.ok) {
      const data = await studioRes.json().catch(() => ({}));
      const items = Array.isArray(data.gallery) ? data.gallery : [];
      setStudio(
        items
          .filter((item: StudioItem) => item && (item.kind === "image" || item.kind === "video") && typeof item.url === "string")
          .map((item: StudioItem & { caption?: string; hashtags?: string[] }) => ({
            id: String(item.id),
            kind: item.kind,
            name: String(item.name || "estudio"),
            url: String(item.url),
            mime: String(item.mime || ""),
            text: postText(item.caption, item.hashtags),
          }))
      );
    }
    if (sch.ok) {
      const data = await sch.json();
      if (data.schedule) {
        setSchedule((s) => ({ ...s, ...data.schedule, times: data.schedule.times?.length ? data.schedule.times : s.times }));
        if (data.schedule.channelIds?.length) setChannels((prev) => (prev.length ? prev : data.schedule.channelIds));
      }
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("enone-creative-updated", refresh);
    return () => window.removeEventListener("enone-creative-updated", refresh);
  }, [load]);

  function toggleChannel(id: string) {
    setChannels((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function send() {
    if (!status?.connected) {
      showToast(L("Conecta Buffer en Integraciones.", "Connect Buffer in Integrations."));
      return;
    }
    const pickedStudio = studio.filter((item) => studioIds.includes(item.id));
    if (!text.trim() && mediaIds.length === 0 && pickedStudio.length === 0) {
      showToast(L("Escribe un texto o adjunta una imagen o un video.", "Write text or attach an image or video."));
      return;
    }
    if (pickedStudio.some((item) => !item.url.startsWith("https://"))) {
      showToast(
        L(
          "Esa creación del estudio no tiene URL pública. Buffer solo publica archivos https.",
          "That studio creation has no public URL. Buffer only publishes https files."
        )
      );
      return;
    }
    if (channels.length === 0) {
      showToast(L("Elige al menos un canal.", "Choose at least one channel."));
      return;
    }
    if (mode === "custom" && !when) {
      showToast(L("Elige fecha y hora.", "Pick a date and time."));
      return;
    }
    setBusy(true);
    try {
      const media = [];
      for (const id of mediaIds) {
        const asset = mediaById.get(id);
        if (!asset) continue;
        let url: string | null = null;
        try {
          url = await ensureCloudMedia(asset, userId, setMediaCloud);
        } catch (e) {
          showToast(`${L("Error subiendo", "Upload error")} ${asset.name}: ${e instanceof Error ? e.message : ""}`);
          return;
        }
        if (!url) {
          showToast(L(`«${asset.name}» no tiene URL pública. Súbelo de nuevo.`, `“${asset.name}” has no public URL. Upload it again.`));
          return;
        }
        media.push({ url, kind: asset.kind, name: asset.name });
      }
      for (const item of pickedStudio) {
        media.push({ url: item.url, kind: item.kind, name: item.name });
      }
      const res = await fetch("/api/buffer/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          media,
          channelIds: channels,
          mode,
          dueAt: mode === "custom" ? new Date(when).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.logs)) setLogs((prev) => [...data.logs, ...prev.filter((l) => !data.logs.some((n: Log) => n.id === l.id))].slice(0, 50));
      if (!res.ok) {
        showToast(data.error || L("No se pudo enviar a Buffer.", "Could not send to Buffer."));
        return;
      }
      showToast(
        mode === "queue"
          ? L("Enviado a la cola de Buffer.", "Added to the Buffer queue.")
          : mode === "now"
            ? L("Buffer publicará esta pieza ahora.", "Buffer will publish this now.")
            : L("Programado en Buffer.", "Scheduled in Buffer.")
      );
      setText("");
      setMediaIds([]);
      setStudioIds([]);
    } catch {
      showToast(L("No se pudo enviar a Buffer.", "Could not send to Buffer."));
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule(resetUsed = false) {
    setSaving(true);
    try {
      const res = await fetch("/api/buffer/schedule", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...schedule, channelIds: schedule.channelIds.length ? schedule.channelIds : channels, resetUsed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || L("No se pudo guardar el horario.", "Could not save the schedule."));
        return;
      }
      if (data.schedule) setSchedule((s) => ({ ...s, ...data.schedule }));
      showToast(resetUsed ? L("Cola de contenido reiniciada.", "Content queue reset.") : L("Horario diario guardado.", "Daily schedule saved."));
    } finally {
      setSaving(false);
    }
  }

  const list = status?.channels || [];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{L("Buffer · cada día", "Buffer · every day")}</h2>
          <p className="text-xs text-slate-500">
            {status?.connected
              ? `${status.accountEmail || status.organizationName || "Buffer"}`
              : L("Conecta tu cuenta para encolar texto, imágenes y videos.", "Connect your account to queue text, images and videos.")}
          </p>
        </div>
        <Link href="/dashboard/integrations" className="text-xs font-semibold text-[var(--brand)] hover:underline">
          {L("Integraciones", "Integrations")}
        </Link>
      </div>

      {!status?.connected && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {status?.error ||
            L(
              "Falta la clave de Buffer. Pégala en Integraciones (Buffer → Ajustes → API).",
              "Buffer credentials are missing. Paste them in Integrations (Buffer → Settings → API)."
            )}
        </div>
      )}

      {list.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {list.map((c) => {
            const on = channels.includes(c.id);
            const blocked = c.isLocked || c.isDisconnected;
            return (
              <button
                key={c.id}
                type="button"
                disabled={blocked || busy}
                onClick={() => toggleChannel(c.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"} disabled:opacity-40`}
              >
                {serviceLabel(c.service)} · {c.displayName || c.name}
                {blocked ? (es ? " (no disponible)" : " (unavailable)") : ""}
              </button>
            );
          })}
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={L("Texto para Buffer…", "Text for Buffer…")}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
      />
      <div className="mt-3">
        <MediaPicker language={language} selectedIds={mediaIds} onChange={setMediaIds} disabled={busy} />
      </div>
      {studio.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {L("Estudio creativo", "Creative studio")}
          </div>
          <div className="flex flex-wrap gap-2">
            {studio.map((item) => {
              const on = studioIds.includes(item.id);
              const pub = item.url.startsWith("https://");
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const turningOn = !studioIds.includes(item.id);
                    setStudioIds((ids) => (ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id]));
                    if (turningOn && item.text) setText(item.text);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}
                >
                  {item.kind === "video" ? "Video" : "Imagen"} · {item.name}
                  {pub ? "" : es ? " · sin URL pública" : " · no public URL"}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          className="rounded-md border border-slate-200 px-2 py-2 text-sm"
        >
          <option value="queue">{L("Cola de Buffer", "Buffer queue")}</option>
          <option value="custom">{L("Hora exacta", "Exact time")}</option>
          <option value="now">{L("Publicar ahora", "Post now")}</option>
        </select>
        {mode === "custom" && (
          <input
            type="datetime-local"
            value={when}
            min={toLocalInput(new Date())}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-md border border-slate-200 px-2 py-2 text-sm"
          />
        )}
        <button
          type="button"
          disabled={busy || !status?.connected}
          onClick={() => void send()}
          className="brand-bg ml-auto rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : L("Enviar a Buffer", "Send to Buffer")}
        </button>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">{L("Automatización diaria", "Daily automation")}</h3>
        <p className="mb-3 text-xs text-slate-500">
          {L(
            "El cron (cada 5 minutos) envía una pieza por horario: borradores, la galería o las creaciones del estudio con URL pública. Si falta contenido o la clave, el error queda en el historial.",
            "The cron (every 5 minutes) sends one piece per time slot from drafts, the gallery, or public creative-studio files. Missing content or credentials are recorded in the history."
          )}
        </p>
        <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => setSchedule((s) => ({ ...s, enabled: e.target.checked }))}
          />
          {L("Activar envío automático cada día", "Turn on automatic daily sending")}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {L("Zona horaria", "Time zone")}
            <select
              value={schedule.timezone}
              onChange={(e) => setSchedule((s) => ({ ...s, timezone: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm font-normal normal-case"
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {L("Modo", "Mode")}
            <select
              value={schedule.mode}
              onChange={(e) => setSchedule((s) => ({ ...s, mode: e.target.value as Schedule["mode"] }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm font-normal normal-case"
            >
              <option value="queue">{L("Añadir a la cola de Buffer", "Add to the Buffer queue")}</option>
              <option value="fixed">{L("Hora exacta de cada franja", "Exact time of each slot")}</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {L("Contenido", "Content")}
            <select
              value={schedule.source}
              onChange={(e) => setSchedule((s) => ({ ...s, source: e.target.value as Schedule["source"] }))}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm font-normal normal-case"
            >
              <option value="both">{L("Borradores y luego galería o estudio", "Drafts, then gallery or studio")}</option>
              <option value="drafts">{L("Solo borradores", "Drafts only")}</option>
              <option value="gallery">{L("Galería y estudio creativo", "Gallery and creative studio")}</option>
            </select>
          </label>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{L("Horas", "Times")}</div>
            <div className="mt-1 space-y-1">
              {schedule.times.map((time, i) => (
                <div key={`${time}-${i}`} className="flex gap-1">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) =>
                      setSchedule((s) => ({ ...s, times: s.times.map((t, idx) => (idx === i ? e.target.value : t)) }))
                    }
                    className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setSchedule((s) => ({ ...s, times: s.times.filter((_, idx) => idx !== i) }))}
                    className="rounded-md border border-slate-200 px-2 text-xs text-slate-500"
                  >
                    ×
                  </button>
                </div>
              ))}
              {schedule.times.length < 8 && (
                <button
                  type="button"
                  onClick={() => setSchedule((s) => ({ ...s, times: [...s.times, "18:00"] }))}
                  className="text-xs font-semibold text-[var(--brand)]"
                >
                  {L("+ Añadir hora", "+ Add time")}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{L("Canales del horario", "Schedule channels")}</div>
          <div className="flex flex-wrap gap-2">
            {list.map((c) => {
              const on = schedule.channelIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={c.isLocked || c.isDisconnected}
                  onClick={() =>
                    setSchedule((s) => ({
                      ...s,
                      channelIds: on ? s.channelIds.filter((id) => id !== c.id) : [...s.channelIds, c.id],
                    }))
                  }
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"} disabled:opacity-40`}
                >
                  {serviceLabel(c.service)} · {c.displayName || c.name}
                </button>
              );
            })}
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={schedule.aiCaptions}
            onChange={(e) => setSchedule((s) => ({ ...s, aiCaptions: e.target.checked }))}
          />
          {L("Generar el texto con IA si hay clave de OpenAI o Anthropic", "Generate the caption with AI when an OpenAI or Anthropic key is set")}
        </label>
        {schedule.aiCaptions && (
          <input
            value={schedule.aiBrief}
            onChange={(e) => setSchedule((s) => ({ ...s, aiBrief: e.target.value }))}
            placeholder={L("Tema opcional, por ejemplo: novedades del estudio", "Optional theme, for example: studio news")}
            className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveSchedule(false)}
            className="brand-bg rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {L("Guardar horario", "Save schedule")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveSchedule(true)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
          >
            {L("Reiniciar cola usada", "Reset used queue")}
          </button>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-3">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">{L("Historial de Buffer", "Buffer history")}</h3>
        <ul className="divide-y divide-slate-100">
          {logs.length === 0 && <li className="py-4 text-center text-sm text-slate-400">{L("Aún no hay envíos.", "No sends yet.")}</li>}
          {logs.slice(0, 20).map((log) => (
            <li key={log.id} className="py-2.5 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${log.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {log.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {log.ok ? L("Enviado", "Sent") : L("Error", "Error")}
                </span>
                <span className="text-slate-500">{log.at ? format(new Date(log.at), "d MMM HH:mm") : ""}</span>
                <span className="text-slate-600">
                  {log.source === "daily" ? L("automático", "automatic") : L("manual", "manual")}
                  {log.channelName ? ` · ${serviceLabel(log.service)} ${log.channelName}` : ""}
                </span>
              </div>
              {log.text && <p className="text-slate-700">{log.text}</p>}
              {log.dueAt && <p className="text-slate-400">{L("Programado", "Due")} {format(new Date(log.dueAt), "d MMM HH:mm")}</p>}
              {log.error && <p className="mt-1 text-rose-700">{log.error}</p>}
              {log.warning && <p className="mt-1 text-amber-700">{log.warning}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
