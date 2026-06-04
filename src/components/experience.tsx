"use client";

import { Reveal } from "./reveal";

const expertise = [
  {
    category: "Generative AI Workflows",
    description:
      "Building end-to-end AI systems that chain multiple models together. Prompt engineering, LangChain pipelines, AI video generation (Runway, Kling, Sora), voice synthesis (ElevenLabs), and visual generation (Midjourney, DALL·E, Stable Diffusion). Producing cinematic content, automating repetitive creative tasks, and shipping AI-powered products.",
  },
  {
    category: "Automation & Bots",
    description:
      "Building scrapers, alert systems, Telegram bots, real-time data pipelines, and ETL workflows. Python-first automation that eliminates manual work. If it can be automated, I've probably done it. Examples: NBA news bot, CityAgent alert system, lasyly.me real-time sports pipeline.",
  },
  {
    category: "Content Creation",
    description:
      "Full video production pipeline — scripting, filming, editing (Premiere Pro, After Effects, DaVinci Resolve, CapCut), motion graphics, thumbnail design, and channel strategy. Combining AI video tools with traditional editing to produce high-quality content solo. Managing content channels, audience growth, and performance analytics.",
  },
  {
    category: "Coding & Development",
    description:
      "Full-stack product development with Python, TypeScript, Next.js, PostgreSQL, WebSockets. Shipped lasyly.me (sports analytics platform), Zone (productivity app), CityAgent (hackathon winner). AI-assisted coding with Cursor, Copilot. Building fast, shipping faster.",
  },
];

export function Experience() {
  return (
    <section className="py-32 px-8">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-20">
            What I Do<span className="text-accent">.</span>
          </h2>
        </Reveal>

        {/* Expertise areas */}
        <div className="space-y-12">
          {expertise.map((item, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div className="border-l-2 border-accent/30 pl-8 py-4">
                <h3 className="text-2xl font-bold mb-3">
                  {item.category}
                </h3>
                <p className="text-base text-white/50 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Tools I use daily */}
        <Reveal delay={0.5}>
          <div className="mt-20 p-8 border border-border rounded-xl bg-surface">
            <h3 className="font-mono text-xs text-accent uppercase tracking-widest mb-6">
              Tools I Use Daily
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <h4 className="text-sm font-semibold mb-2 text-white/70">AI</h4>
                <p className="text-xs text-white/40 leading-relaxed">
                  ChatGPT, Claude, Gemini, Cursor, Midjourney, Runway, Kling, ElevenLabs
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-white/70">Code</h4>
                <p className="text-xs text-white/40 leading-relaxed">
                  Python, TypeScript, Next.js, PostgreSQL, Git, Copilot
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-white/70">Video</h4>
                <p className="text-xs text-white/40 leading-relaxed">
                  Premiere Pro, After Effects, DaVinci, CapCut, Figma
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-white/70">Automation</h4>
                <p className="text-xs text-white/40 leading-relaxed">
                  Scrapers, Bots, Telegram API, WebSockets, ETL pipelines
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
