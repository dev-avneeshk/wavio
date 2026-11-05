export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.6l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function HouseGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="currentColor" d="M3 11.2 12 3.5l9 7.7V20a1 1 0 0 1-1 1h-5.2v-5.6H9.2V21H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

// Points up; rotate it for other directions.
export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m4 10 4-4 4 4" />
    </svg>
  );
}

export function PaintRollerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="14" height="6" rx="1.5" />
        <path d="M17 6h1.5A1.5 1.5 0 0 1 20 7.5v2a1.5 1.5 0 0 1-1.5 1.5H12v3" />
        <rect x="10.5" y="14" width="3" height="7" rx="1" />
      </g>
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m3.5 8.5 3 3 6-7"
      />
    </svg>
  );
}

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path d="M14 5h5v5M19 5l-8 8M10 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

export function ChatIcon({ className }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path d="M5 18.5V6.8A1.8 1.8 0 0 1 6.8 5h10.4A1.8 1.8 0 0 1 19 6.8v7.4a1.8 1.8 0 0 1-1.8 1.8H8.6L5 18.5z" />
    </svg>
  );
}

export function WaveIcon({ className }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path d="M8.5 11.5V6.2a1.3 1.3 0 0 1 2.6 0v4.6M11.1 10.6V4.9a1.3 1.3 0 0 1 2.6 0v5.7M13.7 10.8V6.1a1.3 1.3 0 0 1 2.6 0v6.6M8.5 11.6l-1.3-1.5a1.4 1.4 0 0 0-2.1 1.8l3.4 4.6A6 6 0 0 0 13.3 19h.4a4.6 4.6 0 0 0 4.6-4.6v-4.1a1.3 1.3 0 0 0-2.6 0" />
    </svg>
  );
}

export function ShareIcon({ className }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path d="M12 4v11M8 8l4-4 4 4M5 13v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
    </svg>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M15 15l4.5 4.5" />
    </svg>
  );
}

export function BackIcon({ className }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path d="M14.5 6l-6 6 6 6" />
    </svg>
  );
}

export function SendIcon({ className }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path d="M5 12l14-7-5 14-2.5-5.5L5 12z" />
    </svg>
  );
}
