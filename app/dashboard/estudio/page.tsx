"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { BookOpen, CheckCircle2, XCircle, Timer, Layers, BarChart3, ListChecks, RotateCcw } from "lucide-react";
import { EXAM_FACTS, FLASHCARDS, QUESTIONS, TOPICS, type Question, type TopicId } from "@/lib/estudio";

type CLang = "es" | "en";
type Stat = { c: number; t: number };
type ExamRecord = { at: string; score: number; total: number; byTopic: Record<string, Stat> };
type Progress = { byQuestion: Record<string, Stat>; exams: ExamRecord[] };
type Tab = "temas" | "practica" | "examen" | "tarjetas" | "progreso";

const LS_KEY = "enone-estudio-ga-life";
const EMPTY: Progress = { byQuestion: {}, exams: [] };

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], seed: string): T[] {
  const r = seeded(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** Options in a stable shuffled order; returns order of original indexes. */
function optionOrder(q: Question) {
  return shuffle(q.options.map((_, i) => i), q.id);
}
const topicTitle = (id: TopicId, l: CLang) => TOPICS.find((t) => t.id === id)?.title[l] ?? id;

function useProgress() {
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [server, setServer] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let local: Progress = EMPTY;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) local = JSON.parse(raw) as Progress;
    } catch {
      /* ignore */
    }
    setProgress(local);
    fetch("/api/estudio/progress", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ progress: Progress }>) : Promise.reject()))
      .then((d) => {
        setServer(true);
        const remote = d.progress;
        const remoteCount = Object.values(remote.byQuestion).reduce((s, v) => s + v.t, 0);
        const localCount = Object.values(local.byQuestion).reduce((s, v) => s + v.t, 0);
        if (remoteCount >= localCount) setProgress(remote);
      })
      .catch(() => setServer(false));
  }, []);

  const save = useCallback(
    (next: Progress) => {
      setProgress(next);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void fetch("/api/estudio/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress: next }),
        }).catch(() => undefined);
      }, 800);
    },
    []
  );
  return { progress, save, server };
}

function record(p: Progress, results: { id: string; ok: boolean }[]): Progress {
  const byQuestion = { ...p.byQuestion };
  for (const r of results) {
    const s = byQuestion[r.id] ?? { c: 0, t: 0 };
    byQuestion[r.id] = { c: s.c + (r.ok ? 1 : 0), t: s.t + 1 };
  }
  return { ...p, byQuestion };
}

function QuestionCard({ q, lang, onAnswer, reveal = true, selected, onSelect }: {
  q: Question;
  lang: CLang;
  onAnswer?: (ok: boolean) => void;
  reveal?: boolean;
  selected?: number | null;
  onSelect?: (orig: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [q.id]);
  const order = useMemo(() => optionOrder(q), [q]);
  const chosen = selected !== undefined ? selected : picked;
  const done = reveal && chosen !== null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{topicTitle(q.topic, lang)}</div>
      <p className="mb-3 text-[15px] font-semibold text-slate-800">{q.q}</p>
      <div className="space-y-2">
        {order.map((orig, i) => {
          const isAns = orig === q.answer;
          const isPick = chosen === orig;
          return (
            <button
              key={orig}
              type="button"
              disabled={reveal && done}
              onClick={() => {
                if (onSelect) onSelect(orig);
                else {
                  setPicked(orig);
                  onAnswer?.(isAns);
                }
              }}
              className={clsx(
                "flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                done && isAns && "border-emerald-400 bg-emerald-50",
                done && isPick && !isAns && "border-rose-400 bg-rose-50",
                !done && isPick && "border-[var(--brand)] bg-slate-50",
                !done && !isPick && "border-slate-200 hover:bg-slate-50"
              )}
            >
              <span className="font-bold text-slate-500">{String.fromCharCode(65 + i)}.</span>
              <span className="flex-1">{q.options[orig]}</span>
              {done && isAns && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
              {done && isPick && !isAns && <XCircle className="h-4 w-4 shrink-0 text-rose-600" />}
            </button>
          );
        })}
      </div>
      {done && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <b>{chosen === q.answer ? (lang === "es" ? "¡Correcto! " : "Correct! ") : lang === "es" ? "Incorrecto. " : "Incorrect. "}</b>
          {q.exp[lang]}
        </div>
      )}
    </div>
  );
}

function Practice({ lang, progress, save }: { lang: CLang; progress: Progress; save: (p: Progress) => void }) {
  const [topic, setTopic] = useState<TopicId | "all" | "weak">("all");
  const [seed, setSeed] = useState(() => String(Date.now()));
  const [idx, setIdx] = useState(0);
  const [session, setSession] = useState({ c: 0, t: 0 });
  const pool = useMemo(() => {
    let qs = QUESTIONS;
    if (topic === "weak") qs = QUESTIONS.filter((q) => { const s = progress.byQuestion[q.id]; return !s || s.c / s.t < 0.7; });
    else if (topic !== "all") qs = QUESTIONS.filter((q) => q.topic === topic);
    return shuffle(qs, seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, seed]);
  const q = pool[idx % Math.max(pool.length, 1)];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={topic} onChange={(e) => { setTopic(e.target.value as TopicId | "all" | "weak"); setIdx(0); setSession({ c: 0, t: 0 }); setSeed(String(Date.now())); }} className="min-h-[40px] flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm">
          <option value="all">{lang === "es" ? `Todos los temas (${QUESTIONS.length})` : `All topics (${QUESTIONS.length})`}</option>
          <option value="weak">{lang === "es" ? "Mis temas débiles / sin responder" : "Weak / unanswered"}</option>
          {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.title[lang]} ({QUESTIONS.filter((x) => x.topic === t.id).length})</option>)}
        </select>
        <span className="text-sm text-slate-600">{session.c}/{session.t} ✓</span>
      </div>
      {q ? (
        <>
          <div className="text-xs text-slate-500">{(idx % pool.length) + 1} / {pool.length}</div>
          <QuestionCard q={q} lang={lang} onAnswer={(ok) => { setSession((s) => ({ c: s.c + (ok ? 1 : 0), t: s.t + 1 })); save(record(progress, [{ id: q.id, ok }])); }} />
          <button type="button" onClick={() => setIdx((i) => i + 1)} className="min-h-[44px] w-full rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white">{lang === "es" ? "Siguiente pregunta →" : "Next question →"}</button>
        </>
      ) : (
        <p className="text-sm text-slate-600">{lang === "es" ? "¡No hay preguntas débiles! Prueba con otro tema." : "No weak questions! Try another topic."}</p>
      )}
    </div>
  );
}

function buildExam(): Question[] {
  const seed = String(Date.now());
  const picked = TOPICS.flatMap((t) => shuffle(QUESTIONS.filter((q) => q.topic === t.id), seed + t.id).slice(0, t.examQuestions));
  return shuffle(picked, seed);
}

function Exam({ lang, progress, save }: { lang: CLang; progress: Progress; save: (p: Progress) => void }) {
  const [qs, setQs] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [i, setI] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<ExamRecord | null>(null);

  const finish = useCallback(() => {
    if (!qs) return;
    const byTopic: Record<string, Stat> = {};
    const res = qs.map((q) => ({ id: q.id, ok: answers[q.id] === q.answer, topic: q.topic }));
    for (const r of res) { const s = byTopic[r.topic] ?? { c: 0, t: 0 }; byTopic[r.topic] = { c: s.c + (r.ok ? 1 : 0), t: s.t + 1 }; }
    const rec: ExamRecord = { at: new Date().toISOString(), score: res.filter((r) => r.ok).length, total: qs.length, byTopic };
    const next = record(progress, res);
    save({ ...next, exams: [...next.exams, rec].slice(-20) });
    setResult(rec);
  }, [qs, answers, progress, save]);

  useEffect(() => {
    if (!qs || result) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [qs, result]);
  useEffect(() => { if (qs && !result && endsAt && now >= endsAt) finish(); }, [now, endsAt, qs, result, finish]);

  if (!qs) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <h3 className="text-base font-bold text-slate-800">{lang === "es" ? "Examen simulado" : "Simulated exam"}</h3>
        <p>{lang === "es"
          ? `Formato oficial (${EXAM_FACTS.code}): ${EXAM_FACTS.total} preguntas (${EXAM_FACTS.scored} calificadas + ${EXAM_FACTS.pretest} de prueba sin calificar) en ${EXAM_FACTS.minutes} minutos; se aprueba con ${EXAM_FACTS.passPercent}%. Este simulacro tiene ${EXAM_FACTS.scored} preguntas repartidas por tema como el temario oficial, y ${EXAM_FACTS.minutes} minutos.`
          : `Official format (${EXAM_FACTS.code}): ${EXAM_FACTS.total} questions (${EXAM_FACTS.scored} scored + ${EXAM_FACTS.pretest} unscored pretest) in ${EXAM_FACTS.minutes} minutes; passing score ${EXAM_FACTS.passPercent}%. This simulation has ${EXAM_FACTS.scored} questions weighted by topic like the official outline, and ${EXAM_FACTS.minutes} minutes.`}</p>
        <ul className="list-disc pl-5">{TOPICS.map((t) => <li key={t.id}>{t.title[lang]}: {t.examQuestions}</li>)}</ul>
        <button type="button" onClick={() => { setQs(buildExam()); setAnswers({}); setI(0); setResult(null); setEndsAt(Date.now() + EXAM_FACTS.minutes * 60000); setNow(Date.now()); }} className="min-h-[44px] w-full rounded-lg bg-[var(--brand)] px-4 font-semibold text-white">{lang === "es" ? "Empezar examen" : "Start exam"}</button>
      </div>
    );
  }

  if (result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div className="space-y-3">
        <div className={clsx("rounded-xl p-4 text-white", pct >= EXAM_FACTS.passPercent ? "bg-emerald-600" : "bg-rose-600")}>
          <div className="text-3xl font-bold">{pct}%</div>
          <div>{result.score}/{result.total} — {pct >= EXAM_FACTS.passPercent ? (lang === "es" ? "¡Aprobado en el simulacro!" : "Passed the simulation!") : (lang === "es" ? "Sigue practicando (se necesita 70%)" : "Keep practicing (70% needed)")}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="mb-2 font-semibold">{lang === "es" ? "Calificación por tema" : "Score by topic"}</h4>
          {TOPICS.map((t) => { const s = result.byTopic[t.id] ?? { c: 0, t: 0 }; const p = s.t ? Math.round((s.c / s.t) * 100) : 0; return (
            <div key={t.id} className="mb-2 text-sm"><div className="flex justify-between"><span>{t.title[lang]}</span><b>{s.c}/{s.t}</b></div><div className="h-2 rounded bg-slate-100"><div className={clsx("h-2 rounded", p >= 70 ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${p}%` }} /></div></div>
          ); })}
        </div>
        <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm"><summary className="cursor-pointer font-semibold">{lang === "es" ? "Revisar respuestas" : "Review answers"}</summary>
          <div className="mt-3 space-y-3">{qs.map((q) => <QuestionCard key={q.id} q={q} lang={lang} selected={answers[q.id] ?? -1} onSelect={() => undefined} />)}</div>
        </details>
        <button type="button" onClick={() => setQs(null)} className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white font-semibold"><RotateCcw className="mr-1 inline h-4 w-4" />{lang === "es" ? "Nuevo examen" : "New exam"}</button>
      </div>
    );
  }

  const left = Math.max(0, endsAt - now);
  const q = qs[i];
  const answered = Object.keys(answers).length;
  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
        <span><Timer className="mr-1 inline h-4 w-4" />{Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}</span>
        <span>{i + 1}/{qs.length} · {answered} {lang === "es" ? "respondidas" : "answered"}</span>
      </div>
      <QuestionCard q={q} lang={lang} reveal={false} selected={answers[q.id] ?? null} onSelect={(o) => setAnswers((a) => ({ ...a, [q.id]: o }))} />
      <div className="flex gap-2">
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="min-h-[44px] flex-1 rounded-lg border border-slate-300 bg-white font-semibold disabled:opacity-40">←</button>
        {i < qs.length - 1 ? (
          <button type="button" onClick={() => setI(i + 1)} className="min-h-[44px] flex-1 rounded-lg bg-[var(--brand)] font-semibold text-white">→</button>
        ) : null}
      </div>
      <button type="button" onClick={() => { if (answered === qs.length || window.confirm(lang === "es" ? "Hay preguntas sin responder. ¿Terminar?" : "Some questions are unanswered. Finish?")) finish(); }} className="min-h-[44px] w-full rounded-lg bg-emerald-600 font-semibold text-white">{lang === "es" ? "Terminar y calificar" : "Finish and grade"}</button>
    </div>
  );
}

function Flashcards({ lang }: { lang: CLang }) {
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const cards = useMemo(() => (topic === "all" ? FLASHCARDS : FLASHCARDS.filter((c) => c.topic === topic)), [topic]);
  const c = cards[i % cards.length];
  return (
    <div className="space-y-3">
      <select value={topic} onChange={(e) => { setTopic(e.target.value as TopicId | "all"); setI(0); setFlip(false); }} className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-2 text-sm">
        <option value="all">{lang === "es" ? `Todas (${FLASHCARDS.length})` : `All (${FLASHCARDS.length})`}</option>
        {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.title[lang]}</option>)}
      </select>
      <button type="button" onClick={() => setFlip((f) => !f)} className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl border-2 border-[var(--brand)] bg-white p-6 text-center shadow">
        {!flip ? (
          <><div className="text-xs uppercase text-slate-400">{lang === "es" ? "Término" : "Term"}</div><div className="mt-2 text-2xl font-bold text-slate-800">{c.term}</div><div className="mt-4 text-xs text-slate-400">{lang === "es" ? "Toca para voltear" : "Tap to flip"}</div></>
        ) : (
          <><div className="text-base text-slate-800">{c[lang]}</div><div className="mt-3 text-sm text-slate-500">{c[lang === "es" ? "en" : "es"]}</div></>
        )}
      </button>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { setI((x) => (x - 1 + cards.length) % cards.length); setFlip(false); }} className="min-h-[44px] flex-1 rounded-lg border border-slate-300 bg-white font-semibold">←</button>
        <span className="text-sm text-slate-600">{(i % cards.length) + 1}/{cards.length}</span>
        <button type="button" onClick={() => { setI((x) => (x + 1) % cards.length); setFlip(false); }} className="min-h-[44px] flex-1 rounded-lg bg-[var(--brand)] font-semibold text-white">→</button>
      </div>
    </div>
  );
}

function ProgressView({ lang, progress, server, save }: { lang: CLang; progress: Progress; server: boolean; save: (p: Progress) => void }) {
  const rows = TOPICS.map((t) => {
    const qs = QUESTIONS.filter((q) => q.topic === t.id);
    let c = 0, n = 0, seen = 0;
    for (const q of qs) { const s = progress.byQuestion[q.id]; if (s) { c += s.c; n += s.t; seen++; } }
    return { t, pct: n ? Math.round((c / n) * 100) : null, seen, total: qs.length };
  });
  const weak = rows.filter((r) => r.pct !== null && r.pct < 70);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {rows.map((r) => (
          <div key={r.t.id} className="mb-3 text-sm">
            <div className="flex justify-between gap-2"><span>{r.t.title[lang]}</span><b>{r.pct === null ? "—" : `${r.pct}%`}</b></div>
            <div className="h-2 rounded bg-slate-100"><div className={clsx("h-2 rounded", (r.pct ?? 0) >= 70 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${r.pct ?? 0}%` }} /></div>
            <div className="text-xs text-slate-500">{r.seen}/{r.total} {lang === "es" ? "preguntas vistas" : "questions seen"}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <b>{lang === "es" ? "Temas débiles (menos de 70%): " : "Weak topics (under 70%): "}</b>
        {weak.length ? weak.map((w) => w.t.title[lang]).join(" · ") : lang === "es" ? "ninguno por ahora" : "none yet"}
      </div>
      {progress.exams.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <b>{lang === "es" ? "Exámenes simulados" : "Simulated exams"}</b>
          <ul className="mt-2 space-y-1">{[...progress.exams].reverse().map((e) => <li key={e.at} className="flex justify-between"><span>{new Date(e.at).toLocaleString()}</span><b>{Math.round((e.score / e.total) * 100)}%</b></li>)}</ul>
        </div>
      )}
      <p className="text-xs text-slate-500">{server ? (lang === "es" ? "Tu progreso se guarda en tu cuenta." : "Progress is saved to your account.") : (lang === "es" ? "Progreso guardado en este dispositivo." : "Progress saved on this device.")}</p>
      <button type="button" onClick={() => { if (window.confirm(lang === "es" ? "¿Borrar todo tu progreso?" : "Reset all progress?")) save(EMPTY); }} className="text-xs text-rose-600 underline">{lang === "es" ? "Borrar progreso" : "Reset progress"}</button>
    </div>
  );
}

export default function EstudioPage() {
  const [lang, setLang] = useState<CLang>("es");
  const [tab, setTab] = useState<Tab>("temas");
  const { progress, save, server } = useProgress();
  const tabs: { id: Tab; es: string; en: string; icon: typeof BookOpen }[] = [
    { id: "temas", es: "Temas", en: "Topics", icon: BookOpen },
    { id: "practica", es: "Práctica", en: "Practice", icon: ListChecks },
    { id: "examen", es: "Examen", en: "Exam", icon: Timer },
    { id: "tarjetas", es: "Tarjetas", en: "Flashcards", icon: Layers },
    { id: "progreso", es: "Progreso", en: "Progress", icon: BarChart3 },
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{lang === "es" ? "Estudio: Licencia de Seguro de Vida de Georgia" : "Study: Georgia Life Insurance License"}</h1>
          <p className="text-sm text-slate-500">{EXAM_FACTS.code} · {QUESTIONS.length} {lang === "es" ? "preguntas" : "questions"} · {FLASHCARDS.length} {lang === "es" ? "tarjetas" : "flashcards"}</p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm font-semibold">
          {(["es", "en"] as CLang[]).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} className={clsx("min-h-[36px] px-3", lang === l ? "bg-[var(--brand)] text-white" : "bg-white text-slate-600")}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        ⚠️ <b>Preguntas de práctica, no son preguntas reales del examen.</b> {lang === "es" ? "Las preguntas oficiales son confidenciales. Este contenido sigue el temario público de Pearson VUE para Georgia." : "Official exam questions are confidential. Content follows Pearson VUE's public Georgia outline."}
      </div>
      <div className="grid grid-cols-5 gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((t) => { const I = t.icon; return (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={clsx("flex min-h-[48px] flex-col items-center justify-center rounded-lg text-[11px] font-semibold sm:text-xs", tab === t.id ? "bg-white text-[var(--brand)] shadow" : "text-slate-500")}>
            <I className="mb-0.5 h-4 w-4" />{t[lang]}
          </button>
        ); })}
      </div>

      {tab === "temas" && (
        <div className="space-y-3">
          {TOPICS.map((t) => (
            <details key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-bold text-slate-800">{t.title[lang]} <span className="font-normal text-slate-500">· {t.examQuestions} {lang === "es" ? "preguntas en el examen" : "exam questions"}</span></summary>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">{t.summary[lang].map((s) => <li key={s}>{s}</li>)}</ul>
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><b>{lang === "es" ? "Temario oficial (inglés):" : "Official outline:"}</b><ul className="mt-1 list-disc pl-4">{t.outline.map((o) => <li key={o}>{o}</li>)}</ul></div>
            </details>
          ))}
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
            <b>{lang === "es" ? "Fuentes" : "Sources"}</b>
            <ul className="mt-1 list-disc pl-4">{EXAM_FACTS.sources.map((s) => <li key={s.url}><a className="text-[var(--brand)] underline" href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}</ul>
          </div>
        </div>
      )}
      {tab === "practica" && <Practice lang={lang} progress={progress} save={save} />}
      {tab === "examen" && <Exam lang={lang} progress={progress} save={save} />}
      {tab === "tarjetas" && <Flashcards lang={lang} />}
      {tab === "progreso" && <ProgressView lang={lang} progress={progress} server={server} save={save} />}
    </div>
  );
}
