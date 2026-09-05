export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex flex-col ${className}`}>
      <span className="text-[17px] font-semibold tracking-tight text-[#1e3a5f] leading-none">
        All In One Marketing.com
      </span>
      <svg
        width="168"
        height="8"
        viewBox="0 0 168 8"
        fill="none"
        className="mt-0.5"
        aria-hidden
      >
        <path
          d="M2 5.5C28 1.5 55 1 82 3C109 5 138 6.5 166 3.5"
          stroke="#38a0db"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
