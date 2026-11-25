"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { t } from "@/lib/i18n";
import { serviceLabel } from "@/lib/buffer/model";
import type { BufferChannelInfo, BufferIntegration } from "@/lib/types";
import { useStore } from "@/store/useStore";

type Org = { id: string; name: string; channels: BufferChannelInfo[] };

type Status = {
  connected: boolean;
  authMethod: BufferIntegration["authMethod"];
  accountEmail: string;
  organizationId: string;
  organizationName: string;
  channelIds: string[];
  channels: BufferChannelInfo[];
  oauthAvailable: boolean;
  envAvailable: boolean;
  hasApiKey: boolean;
};

const QUERY_MSG: Record<string, string> = {
  ok: "Buffer conectado.",
  denied: "Cancelaste la autorización de Buffer.",
  oauth_missing: "OAuth de Buffer no está configurado en el servidor. Pega una clave de API.",
  oauth_state: "No se pudo verificar la conexión con Buffer. Inténtalo de nuevo.",
  oauth_error: "Buffer rechazó la conexión. Revisa el cliente OAuth y la URL de retorno.",
};

function channelLine(c: BufferChannelInfo) {
  const bits = [serviceLabel(c.service)];
  if (c.isLocked) bits.push("bloqueado por el plan");
  if (c.isDisconnected) bits.push("desconectado");
  if (c.isQueuePaused) bits.push("cola en pausa");
  return bits.join(" · ");
}

export function BufferConnectCard() {
  const language = useStore((s) => s.settings.language);
  const showToast = useStore((s) => s.showToast);
  const connectBuffer = useStore((s) => s.connectBuffer);
  const disconnectBuffer = useStore((s) => s.disconnectBuffer);
  const storedKey = useStore((s) => s.integrations.buffer?.apiKey || "");

  const [status, setStatus] = useState<Status | null>(null);
  const [apiKey, setApiKey] = useState(storedKey);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<"test" | "save" | "off" | "refresh" | null>(null);

  const es = language === "es";
  const L = useCallback((a: string, b: string) => (es ? a : b), [es]);

  const load = useCallback(async () => {
    const res = await fetch("/api/buffer/status", { credentials: "include", cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as Status;
    setStatus(data);
    if (data.organizationId) setOrgId(data.organizationId);
    if (data.channelIds?.length) setSelected(data.channelIds);
    if (data.channels?.length) {
      setOrgs([{ id: data.organizationId, name: data.organizationName || "Buffer", channels: data.channels }]);
    }
  }, []);

  useEffect(() => {
    void load();
    const q = new URLSearchParams(window.location.search).get("buffer");
    if (q && QUERY_MSG[q]) {
      showToast(QUERY_MSG[q]);
      window.history.replaceState({}, "", "/dashboard/integrations");
    }
  }, [load, showToast]);

  const channels = (orgs.find((o) => o.id === orgId) || orgs[0])?.channels || status?.channels || [];

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function applySnapshot(data: { organizations?: Org[]; email?: string }): string[] {
    const list = data.organizations || [];
    setOrgs(list);
    const org = list.find((o) => o.id === orgId) || list[0];
    if (org) setOrgId(org.id);
    const ids = (org?.channels || []).filter((c) => !c.isLocked && !c.isDisconnected).map((c) => c.id);
    setSelected(ids);
    return ids;
  }

  async function test(useEnv = false): Promise<string[] | null> {
    if (!useEnv && !apiKey.trim()) {
      showToast(t(language, "requiredFields"));
      return null;
    }
    setBusy("test");
    try {
      const res = await fetch("/api/buffer/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useEnv ? { useEnv: true } : { apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || t(language, "testFail"));
        return null;
      }
      const ids = applySnapshot(data);
      showToast(data.message || t(language, "testOk"));
      return ids;
    } catch {
      showToast(t(language, "testFail"));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function save(opts: { useEnv?: boolean; refresh?: boolean; channelIds?: string[] }) {
    const ids = opts.channelIds || selected;
    if (!opts.refresh && !opts.useEnv && !apiKey.trim()) {
      showToast(t(language, "requiredFields"));
      return;
    }
    if (!opts.refresh && ids.length === 0) {
      showToast(L("Elige al menos un canal de Buffer.", "Choose at least one Buffer channel."));
      return;
    }
    setBusy(opts.refresh ? "refresh" : "save");
    try {
      const res = await fetch("/api/buffer/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: opts.useEnv || opts.refresh ? undefined : apiKey.trim(),
          useEnv: Boolean(opts.useEnv),
          refresh: Boolean(opts.refresh),
          organizationId: orgId || undefined,
          channelIds: ids,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || t(language, "testFail"));
        return;
      }
      const integration = data.integration as BufferIntegration;
      const { connected: _connected, apiKey: _ignored, ...rest } = integration;
      const keptKey = apiKey.trim() || useStore.getState().integrations.buffer?.apiKey || "";
      connectBuffer({
        ...rest,
        apiKey: opts.useEnv || integration.authMethod !== "api_key" ? "" : keptKey,
      });
      await load();
      showToast(data.message || (es ? "Buffer conectado" : "Buffer connected"));
    } catch {
      showToast(t(language, "testFail"));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("off");
    try {
      const res = await fetch("/api/buffer/disconnect", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || t(language, "testFail"));
        return;
      }
      disconnectBuffer();
      setApiKey("");
      setOrgs([]);
      setSelected([]);
      setStatus(null);
      await load();
      showToast(es ? "Buffer desconectado" : "Buffer disconnected");
    } finally {
      setBusy(null);
    }
  }

  const connected = Boolean(status?.connected);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">B</span>
          <h2 className="text-sm font-semibold text-slate-700">Buffer</h2>
          {connected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              {t(language, "connectedBadge")}
            </span>
          )}
        </div>
        <Link href="/dashboard/marketing" className="text-xs font-medium text-[var(--brand)] hover:underline">
          {t(language, "marketing")} →
        </Link>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
        {L(
          "Programa publicaciones en la cola de Buffer o a una hora concreta. Crea una clave en Buffer → Ajustes → API (incluido en el plan Free) y pégala aquí. También puedes usar BUFFER_API_KEY en el servidor.",
          "Schedule posts into your Buffer queue or at a set time. Create a key in Buffer → Settings → API (included on Free) and paste it here. BUFFER_API_KEY on the server also works."
        )}
      </p>

      {connected && (
        <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <div className="font-semibold text-slate-800">{status?.accountEmail || L("Cuenta conectada", "Account connected")}</div>
          <div>
            {status?.organizationName || "Buffer"}
            {status?.authMethod === "oauth" ? " · OAuth" : status?.authMethod === "env" ? " · BUFFER_API_KEY" : " · API"}
          </div>
        </div>
      )}

      {!connected && (
        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {L("Clave de API", "API key")}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              placeholder="Buffer → Ajustes → API"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
            />
          </div>
        </div>
      )}

      {orgs.length > 1 && !connected && (
        <label className="mt-3 block text-xs text-slate-600">
          {L("Organización", "Organization")}
          <select
            value={orgId}
            onChange={(e) => {
              setOrgId(e.target.value);
              const org = orgs.find((o) => o.id === e.target.value);
              setSelected((org?.channels || []).filter((c) => !c.isLocked && !c.isDisconnected).map((c) => c.id));
            }}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {channels.length > 0 && (
        <ul className="mt-3 space-y-2">
          {channels.map((c) => {
            const disabled = c.isLocked || c.isDisconnected;
            return (
              <li key={c.id}>
                <label className={`flex items-center gap-2 text-sm ${disabled ? "text-slate-400" : "text-slate-700"}`}>
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    disabled={disabled}
                    onChange={() => toggle(c.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{c.displayName || c.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{channelLine(c)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {connected ? (
          <>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void save({ refresh: true })}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {L("Actualizar canales", "Refresh channels")}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void disconnect()}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
            >
              {t(language, "disconnect")}
            </button>
          </>
        ) : (
          <>
            {status?.envAvailable && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void test(true).then((ids) => ids && save({ useEnv: true, channelIds: ids }))}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
              >
                {L("Usar clave del servidor", "Use server key")}
              </button>
            )}
            {status?.oauthAvailable && (
              <a
                href="/api/buffer/oauth/start"
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {L("Conectar con Buffer", "Connect with Buffer")}
              </a>
            )}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void test(false)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
            >
              {t(language, "testConnection")}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void save({})}
              className="brand-bg rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {L("Guardar y conectar", "Save and connect")}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
