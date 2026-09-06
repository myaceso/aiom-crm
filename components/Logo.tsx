export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex flex-col ${className}`}>
      <span className="text-[17px] font-semibold tracking-tight text-[#0f172a] leading-none">
        enone
      </span>
      <svg
        width="48"
        height="8"
        viewBox="0 0 48 8"
        fill="none"
        className="mt-0.5"
        aria-hidden
      >
        <path
          d="M2 5.5C10 1.5 18 1 24 3C30 5 38 6.5 46 3.5"
          stroke="#6366f1"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-slate-400">
        CRM
      </span>
    </div>
  );
}
