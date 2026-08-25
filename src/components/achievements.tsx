"use client";

import { Reveal } from "./reveal";

const achievementsList = [
  {
    rank: "01",
    scope: "National Recognition",
    title: "ByteVerse 1.0 National Hackathon",
    location: "ICFAI Dehradun",
    description:
      "Placed 4th nationally among 100+ competing engineering teams. Engineered City Agent, a real-time urban traffic and civic anomaly detection dashboard processing multi-stream sensor feeds in under 2 seconds.",
    tag: "National 4th Place",
  },
  {
    rank: "02",
    scope: "Hackathon Winner",
    title: "College-Level Hackathon",
    location: "ICFAI Tech",
    description:
      "Secured 1st place in intensive college hackathon by delivering an end-to-end data-driven product prototype within a strict 24-hour sprint.",
    tag: "1st Place Winner",
  },
  {
    rank: "03",
    scope: "Academic Excellence",
    title: "Entrance Test Merit Scholarship",
    location: "ICFAI Tech",
    description:
      "Awarded competitive academic merit scholarship based on outstanding entrance examination ranking and quantitative aptitude performance.",
    tag: "Scholarship Recipient",
  },
  {
    rank: "04",
    scope: "Athletics & Leadership",
    title: "Captain of College Basketball Team",
    location: "Varsity Athletics",
    description:
      "Led the varsity basketball squad through regional tournaments, fostering communication, strategic tactical execution under pressure, and collective team resilience.",
    tag: "Varsity Captain",
  },
];

export function Achievements() {
  return (
    <section id="achievements" className="py-28 px-6 md:px-12 bg-bg relative border-t border-border">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <p className="font-mono text-xs text-accent-cyan uppercase tracking-widest mb-3">
                06 — Honors & Leadership
              </p>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
                Honors &<br />
                Achievements<span className="text-accent-cyan">.</span>
              </h2>
            </div>
            <p className="text-sm md:text-base text-white/50 max-w-md">
              Recognition in national competitive hackathons, academic scholarship merit, and athletic leadership.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {achievementsList.map((item, idx) => (
            <Reveal key={idx} delay={idx * 0.05}>
              <div className="p-8 rounded-2xl border border-border bg-surface-card hover:border-accent-cyan/40 transition-colors duration-200 flex flex-col justify-between h-full group">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs text-accent-cyan tracking-wider uppercase font-semibold">
                      {item.scope} · {item.location}
                    </span>
                    <span className="font-mono text-xs px-3 py-1 rounded-full bg-surface border border-border text-white/70">
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold text-white tracking-tight group-hover:text-accent-cyan transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs md:text-sm text-white/60 leading-relaxed mt-3">
                    {item.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-border/60 flex items-center justify-between font-mono text-xs text-white/30">
                  <span>Verified Credential</span>
                  <span className="text-accent-cyan font-mono text-xs">CV Verified</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
