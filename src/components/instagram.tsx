"use client";

import { Reveal } from "./reveal";

export function Instagram() {
  return (
    <section className="py-32 px-8 bg-surface">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <div className="flex items-baseline justify-between mb-16">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter">
              Follow<span className="text-accent">.</span>
            </h2>
            <a
              href="https://instagram.com/lasyly.me"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-white/30 hover:text-accent transition-colors"
            >
              @lasyly.me →
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="text-white/40 mb-12 max-w-2xl">
            Building in public — behind the scenes of data pipelines, AI experiments,
            sports analytics, and whatever I&apos;m shipping this week.
          </p>
        </Reveal>

        {/* Instagram Embed */}
        <Reveal delay={0.3}>
          <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-black/20 backdrop-blur">
            <div className="aspect-[16/9] md:aspect-[21/9] w-full">
              <iframe
                src="https://www.instagram.com/lasyly.me/embed"
                className="w-full h-full"
                frameBorder="0"
                scrolling="no"
                allowTransparency
                title="Instagram Feed"
              />
            </div>
          </div>
        </Reveal>

        {/* Alternative: Direct link card if embed doesn't work */}
        <Reveal delay={0.4}>
          <a
            href="https://instagram.com/lasyly.me"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 flex items-center justify-center gap-3 py-4 px-6 border border-border rounded-full text-sm text-white/60 hover:text-accent hover:border-accent/30 transition-all duration-300 w-fit mx-auto"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
            View full feed on Instagram
          </a>
        </Reveal>
      </div>
    </section>
  );
}
