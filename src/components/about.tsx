"use client";

import { Reveal, TextReveal } from "./reveal";

export function About() {
  return (
    <section id="about" className="py-32 px-8 bg-surface">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-20">
            About<span className="text-accent">.</span>
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Main text */}
          <div className="lg:col-span-7 space-y-6">
            <Reveal delay={0.1}>
              <p className="text-xl md:text-2xl text-white/70 leading-relaxed font-light">
                I build with generative AI, automate the boring parts of everything,
                and create content that looks like a full team made it — because
                the AI did half the work.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-base text-white/40 leading-relaxed">
                My core is generative AI and automation. I chain AI tools together
                into workflows that actually produce things — not just demos. ChatGPT,
                Claude, Gemini for ideation and code. Midjourney and DALL·E for visuals.
                Runway Gen-3 and Kling for cinematic AI video. ElevenLabs for voice.
                Cursor and Copilot for shipping code 10x faster. I don&apos;t use
                these as individual tools — I build systems around them.
              </p>
            </Reveal>
            <Reveal delay={0.25}>
              <p className="text-base text-white/40 leading-relaxed">
                Automation is the other side of this. I&apos;ve built bots, scrapers,
                alert pipelines, and real-time data systems that run without
                intervention. If a task is repetitive, I&apos;ve probably already
                written a script for it. The NBA news bot, the CityAgent alert system,
                lasyly.me — all of these are automation at their core.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <p className="text-base text-white/40 leading-relaxed">
                On the content side, I do the whole pipeline. Scripting, filming
                concepts, editing in Premiere Pro, After Effects, DaVinci Resolve,
                and CapCut. Thumbnails, motion graphics, channel strategy. I also use
                AI video tools — Runway, Kling, Sora — to generate cinematic sequences
                that would cost a production team weeks. The output looks polished
                because the workflow is tight.
              </p>
            </Reveal>
            <Reveal delay={0.35}>
              <p className="text-base text-white/40 leading-relaxed">
                On the technical side — Python, SQL, Next.js, TypeScript, PostgreSQL,
                WebSockets. I&apos;ve shipped full-stack products solo. LangChain,
                prompt engineering, AI workflow architecture. The code is the tool,
                not the product. The product is whatever gets built with it.
              </p>
            </Reveal>
          </div>

          {/* Skills sidebar */}
          <div className="lg:col-span-5 lg:pl-8 lg:border-l border-border">
            <div className="space-y-8">
              <Reveal delay={0.2}>
                <div>
                  <h4 className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                    Generative AI
                  </h4>
                  <p className="text-sm text-white/50">
                    ChatGPT, Claude, Gemini, Midjourney, DALL·E, Stable Diffusion,
                    Runway Gen-3, Kling AI, Sora, ElevenLabs, LangChain,
                    Prompt Engineering, AI Workflow Design
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.3}>
                <div>
                  <h4 className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                    Automation & Coding
                  </h4>
                  <p className="text-sm text-white/50">
                    Python, Cursor, GitHub Copilot, Web Scraping, Bots,
                    ETL Pipelines, REST APIs, WebSockets, Real-Time Systems,
                    Next.js, TypeScript, PostgreSQL
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.4}>
                <div>
                  <h4 className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                    Video & Creative
                  </h4>
                  <p className="text-sm text-white/50">
                    Premiere Pro, After Effects, DaVinci Resolve, CapCut,
                    AI Video (Runway, Kling, Sora), Motion Graphics,
                    Thumbnail Design, Scripting, Content Strategy
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.5}>
                <div>
                  <h4 className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                    Languages
                  </h4>
                  <p className="text-sm text-white/50">
                    Python, TypeScript, JavaScript, SQL, Java
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.6}>
                <div>
                  <h4 className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                    Currently Exploring
                  </h4>
                  <p className="text-sm text-white/50">
                    Agent frameworks, AI video automation pipelines,
                    multi-modal content workflows, fine-tuning open models
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
