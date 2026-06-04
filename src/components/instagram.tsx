"use client";

import { Reveal } from "./reveal";

export function Instagram() {
  return (
    <section className="py-24 px-8 border-t border-border">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {/* Instagram icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
              <span className="text-sm text-white/30 font-mono">@lasyly.me</span>
              <span className="text-border text-sm">·</span>
              <span className="text-white/20 text-sm">AI workflows, automation projects & content experiments</span>
            </div>
            <a
              href="https://instagram.com/lasyly.me"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/40 hover:text-accent transition-colors flex items-center gap-2 group"
            >
              Follow
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
