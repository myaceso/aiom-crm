"use client";

import { useEffect, useMemo, useState } from "react";
import { Facebook, Instagram, CheckCircle2, AlertTriangle, Loader2, KeyRound, HelpCircle } from "lucide-react";
import { useStore } from "@/store/useStore";

type TestResult = {
  ok: boolean;
  error?: string;
  tokenKind?: "page" | "user";
  page?: { id: string; name: string };
  instagram?: { id: string; username?: string } | null;
  pages?: { id: string; name?: string }[];
  token?: { valid?: boolean; expiresAt?: string | null; scopes?: string[]; type?: string } | null;
  pageAccessToken?: string;
  warnings?: string[];
};

type ExchangePage = { id: string; name: string; accessToken: string; instagram: { id: string; username?: string } | null };

const input =
  "w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:bg-slate-50";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function MetaConnectPanel() {
  const language = useStore((s) => s.settings.language);
  const connections = useStore((s) => s.socialConnections);
  const connectMeta = useStore((s) => s.connectMeta);
  const disconnectMeta = useStore((s) => s.disconnectMeta);
  const showToast = useStore((s) => s.showToast);
  const L = (es: string, en: string) => (language === "es" ? es : en);

  const fb = connections.find((c) => c.id === "facebook");
  const ig = connections.find((c) => c.id === "instagram");
  const connected = !!fb?.connected;

  const [pageId, setPageId] = useState(fb?.pageId || ig?.pageId || "");
  const [token, setToken] = useState(fb?.accessToken || ig?.accessToken || "");
  const [igUserId, setIgUserId] = useState(ig?.igUserId || fb?.igUserId || "");
  const [busy, setBusy] = useState<"test" | "save" | "exchange" | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [exchangeConfigured, setExchangeConfigured] = useState<boolean | null>(null);
  const [userToken, setUserToken] = useState("");
  const [exPages, setExPages] = useState<ExchangePage[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showExchange, setShowExchange] = useState(false);

  // Sync when CRM state loads after mount
  const key = `${fb?.pageId}|${fb?.accessToken}|${ig?.igUserId}`;
  useEffect(() => {
    setPageId(fb?.pageId || ig?.pageId || "");
    setToken(fb?.accessToken || ig?.accessToken || "");
    setIgUserId(ig?.igUserId || fb?.igUserId || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    fetch("/api/social/meta/exchange", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setExchangeConfigured(!!d.configured))
      .catch(() => setExchangeConfigured(false));
  }, []);

  const dirty = useMemo(
    () =>
      pageId.trim() !== (fb?.pageId || "") ||
      token.trim() !== (fb?.accessToken || "") ||
      igUserId.trim() !== (ig?.igUserId || ""),
    [pageId, token, igUserId, fb, ig]
  );

  async function runTest(): Promise<TestResult> {
    const res = await fetch("/api/social/meta/test", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token.trim(), pageId: pageId.trim(), igUserId: igUserId.trim() }),
    });
    const data = (await res.json().catch(() => ({ ok: false, error: "Error" }))) as TestResult;
    setResult(data);
    return data;
  }

  async function onTest() {
    if (!token.trim()) {
      showToast(L("Pega el Access Token de Meta", "Paste the Meta access token"));
      return;
    }
    setBusy("test");
    try {
      const d = await runTest();
      showToast(d.ok ? L("Conexión correcta", "Connection OK") : d.error || L("Falló la prueba", "Test failed"));
    } catch {
      showToast(L("Falló la prueba", "Test failed"));
    } finally {
      setBusy(null);
    }
  }

  async function onSave() {
    if (!token.trim()) {
      showToast(L("Pega el Access Token de Meta", "Paste the Meta access token"));
      return;
    }
    setBusy("save");
    try {
      const d = await runTest();
      if (!d.ok || !d.page) {
        showToast(d.error || L("No se pudo verificar el token", "Could not verify token"));
        return;
      }
      const igId = igUserId.trim() || d.instagram?.id || "";
      const finalToken = d.pageAccessToken || token.trim();
      connectMeta({
        pageId: d.page.id,
        accessToken: finalToken,
        igUserId: igId,
        pageName: d.page.name,
        igUsername: d.instagram?.username || "",
        connectInstagram: !!igId,
      });
      setPageId(d.page.id);
      setToken(finalToken);
      setIgUserId(igId);
      showToast(
        igId
          ? L("Facebook e Instagram conectados", "Facebook and Instagram connected")
          : L("Facebook conectado (sin Instagram vinculado)", "Facebook connected (no linked Instagram)")
      );
    } finally {
      setBusy(null);
    }
  }

  async function onExchange() {
    if (!userToken.trim()) return;
    setBusy("exchange");
    try {
      const res = await fetch("/api/social/meta/exchange", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: userToken.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        showToast(d.error || "Error");
        return;
      }
      setExPages(d.pages || []);
      if (!d.pages?.length) showToast(L("Ese usuario no administra Páginas", "No Pages for this user"));
    } finally {
      setBusy(null);
    }
  }

  function applyPage(p: ExchangePage) {
    setPageId(p.id);
    setToken(p.accessToken);
    setIgUserId(p.instagram?.id || "");
    setExPages([]);
    setUserToken("");
    showToast(L("Datos cargados — pulsa «Guardar y conectar»", "Loaded — press “Save & connect”"));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex -space-x-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1877F2] text-white ring-2 ring-white">
            <Facebook className="h-5 w-5" />
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white ring-2 ring-white">
            <Instagram className="h-5 w-5" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">Meta · Facebook + Instagram</span>
            {connected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                {L("Conectado", "Connected")}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {connected
              ? `${L("Página", "Page")}: ${fb?.pageName || fb?.pageId} · Instagram: ${
                  ig?.connected ? (ig?.igUsername ? `@${ig.igUsername}` : ig?.igUserId) : L("no vinculado", "not linked")
                }`
              : L(
                  "Publica automáticamente en tu Página de Facebook y tu cuenta profesional de Instagram.",
                  "Auto-publish to your Facebook Page and Instagram professional account."
                )}
          </p>
        </div>
        {connected && (
          <button
            type="button"
            onClick={() => {
              disconnectMeta();
              setToken("");
              setResult(null);
              showToast(L("Meta desconectado", "Meta disconnected"));
            }}
            className="min-h-[36px] rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {L("Desconectar", "Disconnect")}
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>{L("ID de Página de Facebook", "Facebook Page ID")}</label>
          <input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="1234567890" className={input} inputMode="numeric" />
        </div>
        <div>
          <label className={label}>{L("ID de Instagram Business (opcional)", "Instagram Business ID (optional)")}</label>
          <input
            value={igUserId}
            onChange={(e) => setIgUserId(e.target.value)}
            placeholder={result?.instagram?.id || L("Se detecta automáticamente", "Auto-detected")}
            className={input}
            inputMode="numeric"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{L("Access Token de Página (larga duración)", "Page Access Token (long-lived)")}</label>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" className={input} />
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            {L(
              "Permisos: pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish. Si pegas un token de usuario, enone guardará el token de la Página.",
              "Scopes: pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish. If you paste a user token, enone stores the Page token instead."
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <button
          type="button"
          onClick={() => void onTest()}
          disabled={!!busy}
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "test" && <Loader2 className="h-4 w-4 animate-spin" />}
          {L("Probar conexión", "Test connection")}
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={!!busy || (connected && !dirty)}
          className="brand-bg inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
          {connected ? L("Guardar cambios", "Save changes") : L("Guardar y conectar", "Save & connect")}
        </button>
      </div>

      {result && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2.5 text-sm ${
            result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.ok ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-4 w-4" /> {L("Conexión válida", "Connection valid")}
              </div>
              <div>
                <Facebook className="mr-1 inline h-3.5 w-3.5" />
                {result.page?.name} <span className="text-xs opacity-70">(ID {result.page?.id})</span>
              </div>
              <div>
                <Instagram className="mr-1 inline h-3.5 w-3.5" />
                {result.instagram
                  ? `${result.instagram.username ? `@${result.instagram.username}` : ""} (ID ${result.instagram.id})`
                  : L("Sin cuenta de Instagram vinculada", "No linked Instagram account")}
              </div>
              <div className="text-xs opacity-80">
                {L("Tipo de token", "Token type")}: {result.tokenKind === "user" ? L("usuario", "user") : L("página", "page")}
                {result.token?.expiresAt === null && ` · ${L("no caduca", "never expires")}`}
              </div>
              {(result.warnings || []).map((w, i) => (
                <div key={i} className="flex items-start gap-1 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {result.error}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowExchange((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-[var(--brand)] hover:underline"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {L("Convertir token de usuario en token de Página permanente", "Convert user token into a permanent Page token")}
        </button>
        {showExchange && (
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {exchangeConfigured ? (
              <div className="space-y-2">
                <p>
                  {L(
                    "Pega un token de USUARIO (Graph API Explorer). enone lo cambia por uno de larga duración y te muestra tus Páginas con su token permanente.",
                    "Paste a USER token (Graph API Explorer). enone exchanges it for a long-lived one and lists your Pages with permanent tokens."
                  )}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    value={userToken}
                    onChange={(e) => setUserToken(e.target.value)}
                    placeholder="EAAB…"
                    className={input}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => void onExchange()}
                    disabled={!!busy || !userToken.trim()}
                    className="brand-bg inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {busy === "exchange" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {L("Obtener Páginas", "Get Pages")}
                  </button>
                </div>
                {exPages.length > 0 && (
                  <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                    {exPages.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <div>
                          <div className="font-semibold text-slate-800">{p.name}</div>
                          <div className="text-[11px] text-slate-500">
                            ID {p.id} · IG: {p.instagram ? `@${p.instagram.username || p.instagram.id}` : "—"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => applyPage(p)}
                          className="rounded-md border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--brand)]"
                        >
                          {L("Usar esta Página", "Use this Page")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  {L("Abre", "Open")}{" "}
                  <a className="text-[var(--brand)] underline" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">
                    Graph API Explorer
                  </a>
                  {L(", elige tu app y genera un token de usuario con los 5 permisos.", ", pick your app and generate a user token with the 5 scopes.")}
                </li>
                <li>
                  {L("Pégalo en", "Paste it in")}{" "}
                  <a className="text-[var(--brand)] underline" href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noreferrer">
                    Access Token Debugger
                  </a>{" "}
                  {L("y pulsa «Extender token de acceso» (dura ~60 días).", "and click “Extend Access Token” (~60 days).")}
                </li>
                <li>
                  {L(
                    "En Graph API Explorer, con ese token largo, consulta me/accounts: el access_token de tu Página NO caduca. Pégalo arriba.",
                    "In Graph API Explorer, with that long token, query me/accounts: your Page's access_token does NOT expire. Paste it above."
                  )}
                </li>
                <li className="text-slate-400">
                  {L(
                    "(Opcional) Si configuras META_APP_ID y META_APP_SECRET en Vercel, enone hace este cambio automáticamente aquí.",
                    "(Optional) Set META_APP_ID and META_APP_SECRET in Vercel and enone does this exchange here automatically."
                  )}
                </li>
              </ol>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-[var(--brand)] hover:underline"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {L("¿Cómo obtengo el ID de Página y el token?", "How do I get the Page ID and token?")}
        </button>
        {showHelp && (
          <ol className="list-decimal space-y-1 rounded-lg bg-slate-50 p-3 pl-7 text-xs text-slate-600">
            <li>{L("Tu Instagram debe ser cuenta Profesional (Business o Creator) y estar vinculada a tu Página de Facebook (Meta Business Suite → Configuración → Cuentas de Instagram).", "Your Instagram must be a Professional (Business/Creator) account linked to your Facebook Page (Meta Business Suite → Settings → Instagram accounts).")}</li>
            <li>{L("En developers.facebook.com crea una app (tipo Empresa) y añade los productos «Facebook Login for Business» e «Instagram Graph API».", "At developers.facebook.com create a Business app and add “Facebook Login for Business” and “Instagram Graph API”.")}</li>
            <li>{L("En Graph API Explorer genera un token con: pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish.", "In Graph API Explorer generate a token with: pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish.")}</li>
            <li>{L("Conviértelo en token de Página permanente (sección de arriba) y pégalo aquí junto al ID de Página (Página → Información → Transparencia de la página).", "Convert it into a permanent Page token (section above) and paste it here with the Page ID (Page → About → Page transparency).")}</li>
            <li>{L("Pulsa «Probar conexión»: debe mostrar el nombre de tu Página y tu @usuario de Instagram. Luego «Guardar y conectar».", "Press “Test connection”: it should show your Page name and Instagram @username. Then “Save & connect”.")}</li>
            <li>{L("Mientras la app esté en modo Desarrollo solo funciona para administradores/testers de la app; para otros usuarios necesitas App Review y verificación del negocio.", "While the app is in Development mode it only works for app admins/testers; for others you need App Review and Business Verification.")}</li>
          </ol>
        )}
      </div>
    </div>
  );
}
