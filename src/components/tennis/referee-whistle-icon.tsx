export function RefereeWhistleIcon({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8h8l3-3h5v4" />
      <path d="M3 8v5a2 2 0 0 0 2 2h4a6 6 0 1 0 6-6" />
      <circle cx="16" cy="15" r="1" />
    </svg>
  );
}
