"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Stage } from "@/lib/types";
import { useStore } from "@/store/useStore";

const STAGES: Stage[] = ["new", "contacted", "qualified", "proposal", "won", "lost"];

const stageKey = {
  new: "newLead",
  contacted: "contacted",
  qualified: "qualified",
  proposal: "proposal",
  won: "won",
  lost: "lost",
} as const;

export default function OpportunitiesPage() {
  const language = useStore((s) => s.settings.language);
  const opportunities = useStore((s) => s.opportunities);
  const contacts = useStore((s) => s.contacts);
  const addOpportunity = useStore((s) => s.addOpportunity);
  const moveOpportunity = useStore((s) => s.moveOpportunity);
  const showToast = useStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    value: "2500",
    contactId: "",
    stage: "new" as Stage,
  });

  const byStage = useMemo(() => {
    const map: Record<Stage, typeof opportunities> = {
      new: [],
      contacted: [],
      qualified: [],
      proposal: [],
      won: [],
      lost: [],
    };
    opportunities.forEach((o) => map[o.stage].push(o));
    return map;
  }, [opportunities]);

  function onDrop(stage: Stage) {
    if (!dragId) return;
    moveOpportunity(dragId, stage);
    setDragId(null);
    showToast(t(language, "saved"));
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    const contact = contacts.find((c) => c.id === form.contactId) || contacts[0];
    if (!contact) return;
    addOpportunity({
      title: form.title.trim(),
      contactId: contact.id,
      contactName: `${contact.firstName} ${contact.lastName}`,
      value: Number(form.value) || 0,
      stage: form.stage,
      probability: 10,
      owner: "Demo User",
    });
    setOpen(false);
    setForm({ title: "", value: "2500", contactId: "", stage: "new" });
    showToast(t(language, "saved"));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{t(language, "opportunities")}</h1>
          <p className="text-sm text-slate-500">Drag deals between stages</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="brand-bg inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          {t(language, "newDeal")}
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <div
            key={stage}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(stage)}
            className="w-[260px] shrink-0 rounded-xl border border-slate-200 bg-slate-50"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                {t(language, stageKey[stage])}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                {byStage[stage].length}
              </span>
            </div>
            <div className="space-y-2 p-2 min-h-[120px]">
              {byStage[stage].map((deal) => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={() => setDragId(deal.id)}
                  className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                >
                  <p className="text-sm font-semibold text-slate-800">{deal.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{deal.contactName}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--brand)]">
                      ${deal.value.toLocaleString()}
                    </span>
                    <span className="text-slate-400">{deal.probability}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={onCreate} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">{t(language, "newDeal")}</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  {t(language, "dealTitle")}
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  {t(language, "value")}
                </label>
                <input
                  type="number"
                  required
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Contact</label>
                <select
                  value={form.contactId}
                  onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  {t(language, "stage")}
                </label>
                <select
                  value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {t(language, stageKey[s])}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-3 py-2 text-sm">
                {t(language, "cancel")}
              </button>
              <button type="submit" className="brand-bg rounded-md px-3 py-2 text-sm font-semibold text-white">
                {t(language, "create")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
