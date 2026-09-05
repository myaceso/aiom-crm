"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Contact } from "@/lib/types";
import { useStore } from "@/store/useStore";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  tags: "" as string,
  source: "Organic",
  status: "lead" as Contact["status"],
};

export default function ContactsPage() {
  const language = useStore((s) => s.settings.language);
  const contacts = useStore((s) => s.contacts);
  const addContact = useStore((s) => s.addContact);
  const updateContact = useStore((s) => s.updateContact);
  const addNote = useStore((s) => s.addNote);
  const showToast = useStore((s) => s.showToast);

  const [q, setQ] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [note, setNote] = useState("");

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return contacts;
    return contacts.filter((c) =>
      [c.firstName, c.lastName, c.email, c.phone, c.company, ...c.tags]
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [contacts, q]);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setModal("create");
  }

  function openEdit(c: Contact) {
    setForm({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      company: c.company,
      tags: c.tags.join(", "),
      source: c.source,
      status: c.status,
    });
    setEditingId(c.id);
    setModal("edit");
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      company: form.company.trim(),
      tags: form.tags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      source: form.source,
      status: form.status,
    };
    if (modal === "edit" && editingId) {
      updateContact(editingId, payload);
      if (selected?.id === editingId) setSelected({ ...selected, ...payload });
    } else {
      addContact(payload);
    }
    setModal(null);
    showToast(t(language, "saved"));
  }

  function submitNote() {
    if (!selected || !note.trim()) return;
    addNote(selected.id, note.trim());
    const updated = useStore.getState().contacts.find((c) => c.id === selected.id);
    if (updated) setSelected(updated);
    setNote("");
    showToast(t(language, "saved"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{t(language, "contacts")}</h1>
          <p className="text-sm text-slate-500">{contacts.length} records</p>
        </div>
        <button
          onClick={openCreate}
          className="brand-bg inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          {t(language, "addContact")}
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t(language, "searchContacts")}
          className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">{t(language, "name")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "email")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "phone")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "company")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "tags")}</th>
              <th className="px-4 py-3 font-semibold">{t(language, "status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelected(c)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-800">
                  {c.firstName} {c.lastName}
                </td>
                <td className="px-4 py-3">{c.email}</td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3">{c.company}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 capitalize">{c.status}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {t(language, "noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {selected.firstName} {selected.lastName}
                </h2>
                <p className="text-xs text-slate-500">{selected.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(selected)}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium"
                >
                  {t(language, "editContact")}
                </button>
                <button onClick={() => setSelected(null)} className="rounded p-1 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">{t(language, "phone")}</p>
                  <p className="font-medium text-slate-700">{selected.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t(language, "company")}</p>
                  <p className="font-medium text-slate-700">{selected.company}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Source</p>
                  <p className="font-medium text-slate-700">{selected.source}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t(language, "status")}</p>
                  <p className="font-medium capitalize text-slate-700">{selected.status}</p>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">{t(language, "tags")}</h3>
                <div className="flex flex-wrap gap-1">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">{t(language, "notes")}</h3>
                <div className="mb-2 flex gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t(language, "addNote")}
                    className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none"
                  />
                  <button
                    onClick={submitNote}
                    className="brand-bg rounded-md px-3 py-2 text-sm font-semibold text-white"
                  >
                    {t(language, "save")}
                  </button>
                </div>
                <ul className="space-y-2">
                  {selected.notes.map((n) => (
                    <li key={n.id} className="rounded-md bg-slate-50 p-3 text-sm">
                      <p className="text-slate-700">{n.body}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {n.author} · {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">{t(language, "timeline")}</h3>
                <ul className="space-y-2 border-l border-slate-200 pl-3">
                  {selected.timeline.map((ev) => (
                    <li key={ev.id} className="text-sm">
                      <p className="font-medium text-slate-700">{ev.title}</p>
                      <p className="text-xs capitalize text-slate-400">
                        {ev.type} · {new Date(ev.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={onSave}
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-800">
              {modal === "create" ? t(language, "addContact") : t(language, "editContact")}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["firstName", "First name"],
                  ["lastName", "Last name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["company", "Company"],
                  ["tags", "Tags (comma)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className={key === "tags" || key === "company" ? "col-span-2" : ""}>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
                  <input
                    required={key !== "tags"}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Source</label>
                <select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  {["Facebook Ads", "Google Ads", "Organic", "Referral", "Walk-in", "Chat Widget"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as Contact["status"] })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="lead">Lead</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                {t(language, "cancel")}
              </button>
              <button type="submit" className="brand-bg rounded-md px-3 py-2 text-sm font-semibold text-white">
                {t(language, "save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
