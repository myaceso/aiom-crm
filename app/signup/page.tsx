"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import AuthHeader from "@/components/AuthHeader";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

export default function SignupPage() {
  const language=useStore((s)=>s.settings.language);
  const [form,setForm]=useState({name:"",email:"",password:""});
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [success,setSuccess]=useState("");
  async function submit(e:FormEvent) {
    e.preventDefault(); setError(""); setSuccess("");
    if(!form.name.trim() || !form.email.trim() || form.password.length<8) { setError(t(language,"signupInvalid")); return; }
    setBusy(true);
    try {
      const res=await fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const data=await res.json().catch(()=>({}));
      if(!res.ok) { setError(data.error==="email_taken"?t(language,"emailTaken"):t(language,"signupInvalid")); return; }
      setSuccess(data.emailSent?t(language,"signupSuccess"):t(language,"signupEmailNotConfigured"));
      setForm({name:"",email:form.email,password:""});
    } catch { setError(t(language,"serverError")); } finally { setBusy(false); }
  }
  return <div className="flex min-h-screen flex-col bg-slate-50"><AuthHeader/><main className="flex flex-1 items-center justify-center px-4 py-10"><div className="w-full max-w-md rounded-xl bg-white p-6 shadow-card sm:p-9"><h1 className="text-center text-2xl font-semibold text-slate-700">{t(language,"createAccount")}</h1><p className="mt-2 text-center text-sm text-slate-500">{t(language,"signupSubtitle")}</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-semibold text-slate-600">{t(language,"userName")}<input required autoComplete="name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-indigo-200"/></label><label className="block text-sm font-semibold text-slate-600">{t(language,"email")}<input required type="email" autoComplete="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-indigo-200"/></label><label className="block text-sm font-semibold text-slate-600">{t(language,"password")}<input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} className="mt-1.5 w-full rounded-md border border-slate-200 px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-indigo-200"/></label>{error&&<p className="text-sm text-rose-600">{error}</p>}{success&&<div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}<button disabled={busy} className="brand-bg w-full rounded-md py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy?t(language,"sending"):t(language,"createAccount")}</button></form><p className="mt-6 text-center text-sm text-slate-500">{t(language,"alreadyHaveAccount")} <Link href="/login" className="font-semibold text-indigo-600 hover:underline">{t(language,"signIn")}</Link></p></div></main></div>;
}
