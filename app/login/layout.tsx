import { Suspense } from "react";
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="boot-spinner" /></div>}>{children}</Suspense>;
}
