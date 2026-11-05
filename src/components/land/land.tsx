"use client";

import dynamic from "next/dynamic";
import type { LandProps } from "./land-view";

// three.js only runs in the browser; the sky-and-grass placeholder shows while it loads.
const LandView = dynamic(() => import("./land-view"), {
  ssr: false,
  loading: () => <LandPlaceholder />,
});

export function Land(props: LandProps) {
  return <LandView {...props} />;
}

function LandPlaceholder() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#7FB2E0_0%,#C9DEEE_38%,#DDE8EE_47%,#A9D47C_48%,#86C95A_100%)]">
      <p className="absolute inset-x-0 top-[44%] text-center text-sm font-medium text-zinc-600/80">Building the city...</p>
    </div>
  );
}
