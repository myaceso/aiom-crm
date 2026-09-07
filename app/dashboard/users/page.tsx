"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, UserPlus, UserX, UserCheck, Mail } from "lucide-react";
import {
  ALL_PERMISSIONS,
  STAFF_PERMISSIONS,
  isAdmin,
} from "@/lib/auth";
import { t, type DictKey } from "@/lib/i18n";
import type { SafeUser, PermissionKey, UserRole } from "@/lib/types";
import { useStore } from "@/store/useStore";
import clsx from "clsx";

const PERM_LABEL: Record<PermissionKey, DictKey> = {
  contacts: "perm_contacts",
  conversations: "perm_conversations",
  opportunities: "perm_opportunities",
  marketing: "perm_marketing",
  sms: "perm_sms",
  email: "perm_email",
  whatsapp: "perm_whatsapp",
  telegram: "perm_telegram",
  integrations: "perm_integrations",
  reporting: "perm_reporting",
  payments: "perm_payments",
  sites: "perm_sites",
  calendars: "perm_calendars",
  settings: "perm_settings",
  users: "perm_users",
};

type FormState = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  permissions: PermissionKey[];
  active: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  email: "",
  password: "",
  role: "staff",
  permissions: [],
  active: true,
});

export default function UsersPage() {
  const language = useStore((s) => s.settings.language);
  const users = useStore((s) => s.users);
  const session = useStore((s) => s.session);
  const createUser = useStore((s) => s.createUser);
  const updateUser = useStore((s) => s.updateUser);
  const deactivateUser = useStore((s) => s.deactivateUser);
  const resendVerification = useStore((s) => s.resendVerification);
  const showToast = useStore((s) => s.showToast);
  const fetchUsers = useStore((s) => s.fetchUsers);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const me = users.find((u) => u.id === session?.userId) ?? null;
  const admin = isAdmin(me);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(
    () =>
      [...users].sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [users]
  );

  if (!admin) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
        {t(language, "accessDenied")}
      </div>
    );
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setOpen(true);
  }

  function openEdit(u: SafeUser) {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      permissions: [...u.permissions],
      active: u.active,
    });
    setError("");
    setOpen(true);
  }

  function togglePerm(p: PermissionKey) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p)
        ? f.permissions.filter((x) => x !== p)
        : [...f.permissions, p],
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (editingId) {
        const res = await updateUser(editingId, {
          name: form.name,
          email: form.email,
          role: form.role,
          permissions: form.permissions,
          active: form.active,
          ...(form.password ? { password: form.password } : {}),
        });
        if (!res.ok) {
          setError(
            res.error === "email_taken"
              ? t(language, "emailTaken")
              : res.error === "last_admin"
                ? t(language, "lastAdminError")
                : res.error === "invalid"
                  ? t(language, "passwordTooShort")
                  : t(language, "forbidden")
          );
          return;
        }
        showToast(t(language, "userUpdated"));
      } else {
        if (form.password.length < 4) {
          setError(t(language, "passwordTooShort"));
          return;
        }
        const res = await createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          permissions: form.permissions,
        });
        if (!res.ok) {
          setError(
            res.error === "email_taken"
              ? t(language, "emailTaken")
              : res.error === "invalid"
                ? t(language, "requiredFields")
                : t(language, "forbidden")
          );
          return;
        }
        showToast(t(language, "userCreated"));
      }
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: SafeUser) {
    if (u.active) {
      const res = await deactivateUser(u.id);
      if (!res.ok) {
        showToast(
          res.error === "last_admin"
            ? t(language, "lastAdminError")
            : t(language, "forbidden")
        );
        return;
      }
      showToast(t(language, "userDeactivated"));
    } else {
      const res = await updateUser(u.id, { active: true });
      if (!res.ok) {
        showToast(t(language, "forbidden"));
        return;
      }
      showToast(t(language, "userActivated"));
    }
  }

  const checkboxList =
    form.role === "admin" ? ALL_PERMISSIONS : STAFF_PERMISSIONS;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {t(language, "users")}
          </h1>
          <p className="text-sm text-slate-500">{t(language, "team")}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" />
          {t(language, "createUser")}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{t(language, "name")}</th>
                <th className="px-4 py-3 font-semibold">{t(language, "email")}</th>
                <th className="px-4 py-3 font-semibold">{t(language, "role")}</th>
                <th className="px-4 py-3 font-semibold">{t(language, "status")}</th>
                <th className="px-4 py-3 font-semibold">{t(language, "actions")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    {t(language, "noUsers")}
                  </td>
                </tr>
              )}
              {sorted.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {u.name}
                    {u.id === session?.userId && (
                      <span className="ml-2 text-xs text-slate-400">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        u.role === "admin"
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {u.role === "admin"
                        ? t(language, "roleAdmin")
                        : t(language, "roleStaff")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        u.active
                          ? "bg-emerald-50 text-emerald-700"
                          : !u.emailVerifiedAt
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-600"
                      )}
                    >
                      {u.active
                        ? t(language, "active")
                        : !u.emailVerifiedAt
                          ? t(language, "pending")
                          : t(language, "inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                        title={t(language, "editUser")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {!u.active && !u.emailVerifiedAt && (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await resendVerification(u.id);
                            showToast(
                              res.ok
                                ? t(language, "verificationResent")
                                : t(
                                    language,
                                    res.error === "email_not_configured"
                                      ? "emailNotConfigured"
                                      : "serverError"
                                  )
                            );
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                          title={t(language, "resendVerification")}
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                        title={
                          u.active
                            ? t(language, "deactivate")
                            : t(language, "activateManually")
                        }
                      >
                        {u.active ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl sm:p-6"
            role="dialog"
            aria-modal="true"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-800">
              {editingId ? t(language, "editUser") : t(language, "createUser")}
            </h2>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600">
                  {t(language, "userName")}
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600">
                  {t(language, "userEmail")}
                </label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600">
                  {editingId
                    ? t(language, "newPasswordOptional")
                    : t(language, "userPassword")}
                </label>
                <input
                  type="password"
                  required={!editingId}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-600">
                  {t(language, "role")}
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      role: e.target.value as UserRole,
                      permissions:
                        e.target.value === "admin"
                          ? [...ALL_PERMISSIONS]
                          : f.permissions.filter((p) => p !== "users"),
                    }))
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                >
                  <option value="staff">{t(language, "roleStaff")}</option>
                  <option value="admin">{t(language, "roleAdmin")}</option>
                </select>
              </div>

              {form.role === "staff" && (
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-600">
                        {t(language, "permissions")}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t(language, "permissionsHint")}
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        className="font-medium text-[var(--brand)] hover:underline"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            permissions: [...STAFF_PERMISSIONS],
                          }))
                        }
                      >
                        {t(language, "selectAll")}
                      </button>
                      <button
                        type="button"
                        className="font-medium text-slate-500 hover:underline"
                        onClick={() =>
                          setForm((f) => ({ ...f, permissions: [] }))
                        }
                      >
                        {t(language, "clearAll")}
                      </button>
                    </div>
                  </div>
                  <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-md border border-slate-100 p-3 sm:grid-cols-2">
                    {checkboxList.map((p) => (
                      <label
                        key={p}
                        className="flex min-h-[36px] cursor-pointer items-center gap-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={form.permissions.includes(p)}
                          onChange={() => togglePerm(p)}
                          className="h-4 w-4 rounded border-slate-300 text-[var(--brand)] focus:ring-[var(--brand)]"
                        />
                        {t(language, PERM_LABEL[p])}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {editingId && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, active: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {t(language, "active")}
                </label>
              )}

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-[40px] rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  {t(language, "cancel")}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[40px] rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {editingId ? t(language, "save") : t(language, "create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
