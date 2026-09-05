"use client";

import Logo from "./Logo";
import LanguageSelector from "./LanguageSelector";

export default function AuthHeader() {
  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-slate-100 bg-white px-5">
      <Logo />
      <LanguageSelector />
    </header>
  );
}
