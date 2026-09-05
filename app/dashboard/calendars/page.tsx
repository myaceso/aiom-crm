"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8–18

export default function CalendarsPage() {
  const language = useStore((s) => s.settings.language);
  const appointments = useStore((s) => s.appointments);
  const addAppointment = useStore((s) => s.addAppointment);
  const showToast = useStore((s) => s.showToast);

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    contactName: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "10:00",
    endTime: "10:30",
    calendar: "Sales",
    status: "confirmed" as const,
  });

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  function hourOf(iso: string) {
    return parseISO(iso).getHours() + parseISO(iso).getMinutes() / 60;
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    const start = new Date(`${form.date}T${form.startTime}:00`);
    const end = new Date(`${form.date}T${form.endTime}:00`);
    addAppointment({
      title: form.title.trim(),
      contactName: form.contactName.trim() || "Guest",
      start: start.toISOString(),
      end: end.toISOString(),
      calendar: form.calendar,
      status: form.status,
    });
    setOpen(false);
    setForm({
      title: "",
      contactName: "",
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: "10:00",
      endTime: "10:30",
      calendar: "Sales",
      status: "confirmed",
    });
    showToast(t(language, "saved"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{t(language, "calendars")}</h1>
          <p className="text-sm text-slate-500">{t(language, "weekView")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="rounded-md border border-slate-200 bg-white p-2 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            Today
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="rounded-md border border-slate-200 bg-white p-2 hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOpen(true)}
            className="brand-bg inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            {t(language, "newAppointment")}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-200">
            <div className="p-2" />
            {days.map((d) => (
              <div
                key={d.toISOString()}
                className={`border-l border-slate-100 p-2 text-center text-sm ${
                  isSameDay(d, new Date()) ? "bg-sky-50 font-semibold text-[var(--brand)]" : "text-slate-600"
                }`}
              >
                <div className="text-xs uppercase text-slate-400">{format(d, "EEE")}</div>
                <div>{format(d, "MMM d")}</div>
              </div>
            ))}
          </div>
          <div className="relative grid grid-cols-[64px_repeat(7,1fr)]">
            {HOURS.map((hour) => (
              <div key={hour} className="contents">
                <div className="h-16 border-t border-slate-100 pr-2 pt-1 text-right text-[11px] text-slate-400">
                  {format(new Date().setHours(hour, 0, 0, 0), "h a")}
                </div>
                {days.map((d) => (
                  <div
                    key={`${d.toISOString()}-${hour}`}
                    className="relative h-16 border-l border-t border-slate-100"
                  >
                    {appointments
                      .filter((a) => isSameDay(parseISO(a.start), d))
                      .filter((a) => Math.floor(hourOf(a.start)) === hour)
                      .map((a) => {
                        const startH = hourOf(a.start);
                        const endH = hourOf(a.end);
                        const top = ((startH - hour) / 1) * 100;
                        const height = Math.max((endH - startH) * 64, 28);
                        return (
                          <div
                            key={a.id}
                            className="absolute left-1 right-1 z-10 overflow-hidden rounded-md border border-[var(--brand)]/30 bg-[var(--brand)]/15 px-1.5 py-1 text-[11px] text-slate-800"
                            style={{ top: `${top}%`, height }}
                            title={`${a.title} · ${a.contactName}`}
                          >
                            <div className="truncate font-semibold">{a.title}</div>
                            <div className="truncate text-slate-500">{a.contactName}</div>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Upcoming</h2>
        <ul className="divide-y divide-slate-100">
          {[...appointments]
            .sort((a, b) => +new Date(a.start) - +new Date(b.start))
            .map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{a.title}</p>
                  <p className="text-xs text-slate-500">
                    {a.contactName} · {a.calendar} · {a.status}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(a.start).toLocaleString()}
                </span>
              </li>
            ))}
        </ul>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={onCreate} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">
              {t(language, "newAppointment")}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Contact</label>
                <input
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Date</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Start</label>
                  <input
                    type="time"
                    required
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">End</label>
                  <input
                    type="time"
                    required
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Calendar</label>
                <select
                  value={form.calendar}
                  onChange={(e) => setForm({ ...form, calendar: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  {["Sales", "Success", "Marketing"].map((c) => (
                    <option key={c}>{c}</option>
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
