// Isometric house on a pegged plot. The sign shows the visitor's place in line once they join.
// Coordinates come from a simple isometric projection: x' = 200 + (x - y) * 0.866, y' = 255 + (x + y) * 0.5 - z.

type HouseArtProps = {
  reserved: boolean;
  plot: string;
};

const ACCENT = "#e9c46a";
const ACCENT_SOFT = "#f3dc9b";

export function HouseArt({ reserved, plot }: HouseArtProps) {
  const windowFill = reserved ? ACCENT_SOFT : "#3f3f46";

  return (
    <svg
      viewBox="0 90 400 300"
      role="img"
      aria-label={reserved ? `A house on plot ${plot}, reserved for you` : "An empty plot with a house waiting for an owner"}
      className="h-auto w-full"
    >
      <ellipse cx="200" cy="374" rx="150" ry="10" fill="#09090b" opacity="0.6" />

      <g className="animate-float">
        {/* Plot slab */}
        <polygon points="364.54,255 200,350 200,362 364.54,267" fill="#141417" />
        <polygon points="200,350 35.46,255 35.46,267 200,362" fill="#1b1b1f" />
        <polygon points="200,160 364.54,255 200,350 35.46,255" fill="#232328" />
        <polygon
          points="200,170 347.22,255 200,340 52.78,255"
          fill="none"
          stroke={ACCENT}
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />

        {/* Garden path and porch light spill */}
        <polygon points="169.69,277.5 187.01,287.5 139.38,315 122.06,305" fill="#3a3a41" />
        {reserved && <ellipse cx="160" cy="300" rx="46" ry="18" fill={ACCENT} opacity="0.12" />}

        {/* Back tree */}
        <rect x="320" y="226" width="4" height="26" rx="2" fill="#52525b" />
        <circle cx="322" cy="212" r="22" fill="#4b4b53" />
        <circle cx="309" cy="225" r="12" fill="#5a5a63" />

        {/* House shadow */}
        <polygon points="175.34,214 261.94,264 192.66,304 106.06,254" fill="#09090b" opacity="0.45" />

        {/* Right wall with gable */}
        <polygon points="277.94,260 208.66,300 208.66,230 243.3,160 277.94,190" fill="#a1a1aa" />
        {/* Front wall */}
        <polygon points="208.66,300 122.06,250 122.06,180 208.66,230" fill="#e4e4e7" />
        {/* Roof */}
        <polygon points="122.06,180 208.66,230 243.3,160 156.7,110" fill={ACCENT} />
        <polyline
          points="122.06,180 208.66,230 243.3,160"
          fill="none"
          stroke="#b8963e"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Chimney */}
        <polygon points="152.37,152.5 165.36,160 165.36,120 152.37,112.5" fill="#d4d4d8" />
        <polygon points="165.36,160 175.75,139 175.75,114 165.36,120" fill="#71717a" />
        <polygon points="162.76,106.5 175.75,114 165.36,120 152.37,112.5" fill="#52525b" />

        {/* Door and windows */}
        <polygon points="169.69,277.5 187.01,287.5 187.01,247.5 169.69,237.5" fill="#52525b" />
        <circle cx="183.5" cy="268" r="1.6" fill={ACCENT} />
        <polygon
          points="130.72,230 152.37,242.5 152.37,219.5 130.72,207"
          fill={windowFill}
          className={reserved ? "animate-glow" : undefined}
        />
        <polygon
          points="264.95,242.5 238.97,257.5 238.97,234.5 264.95,219.5"
          fill={windowFill}
          className={reserved ? "animate-glow" : undefined}
        />

        {/* Front tree and bush */}
        <rect x="268" y="284" width="4" height="15" rx="2" fill="#52525b" />
        <circle cx="270" cy="280" r="13" fill="#5a5a63" />
        <ellipse cx="232" cy="304" rx="16" ry="10" fill="#4b4b53" />

        {/* Plot sign */}
        <rect x="68.6" y="200" width="3" height="56" rx="1.5" fill="#71717a" />
        <rect x="24" y="166" width="92" height="42" rx="7" fill="#f4f4f5" />
        <text
          x="70"
          y="182"
          textAnchor="middle"
          fontSize="8.5"
          letterSpacing="2"
          fill="#71717a"
          className="font-mono"
        >
          {reserved ? "RESERVED" : "PLOT"}
        </text>
        <text
          x="70"
          y="200"
          textAnchor="middle"
          fontSize="15"
          fontWeight="700"
          fill="#18181b"
          className="font-mono"
        >
          {plot}
        </text>
      </g>
    </svg>
  );
}
