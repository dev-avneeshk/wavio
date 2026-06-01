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
                I&apos;m a data engineer, AI builder, and creative technologist who
                treats every tool as a lever — from Python scripts to cinematic AI
                video generators.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-base text-white/40 leading-relaxed">
                Most of my work involves Python, SQL, and whatever gets data from
                point A to a decision at point B as fast as possible. I designed and
                shipped lasyly.me — a live sports analytics platform processing data
                across 10+ leagues with sub-500ms latency using WebSockets, ML models,
                and a unified data layer.
              </p>
            </Reveal>
            <Reveal delay={0.25}>
              <p className="text-base text-white/40 leading-relaxed">
                On the AI side — I live in this space. I use generative AI daily for
                everything: ChatGPT, Claude, Gemini for ideation and code, Midjourney
                and DALL·E for visuals, Runway and Kling for cinematic AI video,
                ElevenLabs for voice, Cursor and Copilot for shipping code 10x faster.
                I don&apos;t just &quot;use AI tools&quot; — I build workflows around them,
                chain them together, and produce things that look like a full team made them.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <p className="text-base text-white/40 leading-relaxed">
                I also run content channels — video editing, scripting, thumbnail design,
                audience growth. I know Premiere Pro, After Effects, DaVinci Resolve,
                CapCut, and how to turn a raw idea into a polished video that performs.
                The whole pipeline from concept to publish.
              </p>
            </Reveal>
            <Reveal delay={0.35}>
              <p className="text-base text-white/40 leading-relaxed">
                B.Sc. in Data Analytics from ICFAI Tech Hyderabad (2023–2026).
                Previously interned at Skillbanc where I shipped production components
                and used interaction data to fix UX problems. Certified through
                Deloitte and KPMG analytics programs.
              </p>
            </Reveal>
            <Reveal delay={0.4}>
              <p className="text-base text-white/40 leading-relaxed">
                Outside of work — basketball, sports modeling, building automation
                bots, and experimenting with whatever new AI model dropped this week.
              </p>
            </Reveal>
          </div>

          {/* Skills sidebar */}
          <div className="lg:col-span-5 lg:pl-8 lg:border-l border-border">
            <div className="space-y-8">
              <Reveal delay={0.2}>
                <div>
                  <h4 className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                    Languages
                  </h4>
                  <p className="text-sm text-white/50">
                    Python, SQL, JavaScript, TypeScript, Java
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.3}>
                <div>
                  <h4 className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                    Data & ML
                  </h4>
                  <p className="text-sm text-white/50">
                    Pandas, NumPy, Scikit-learn, Statistical Analysis, Predictive
                    Modeling, A/B Testing, EDA, Feature Engineering, Anomaly Detection
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.4}>
                <div>
                  <h4 className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                    Visualization
                  </h4>
                  <p className="text-sm text-white/50">
                    Tableau, Power BI, Matplotlib, Seaborn, Dashboard Design
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.5}>
                <div>
                  <h4 className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                    Engineering
                  </h4>
                  <p className="text-sm text-white/50">
                    PostgreSQL, MySQL, Supabase, WebSockets, ETL Pipelines,
                    Real-Time Ingestion, Data Modeling, REST APIs
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.6}>
                <div>
                  <h4 className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                    Tools
                  </h4>
                  <p className="text-sm text-white/50">
                    Git, React, Next.js, Flask, Vercel, Jupyter, Agile/Scrum
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.7}>
                <div>
                  <h4 className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                    Generative AI
                  </h4>
                  <p className="text-sm text-white/50">
                    ChatGPT, Claude, Gemini, Midjourney, DALL·E, Stable Diffusion,
                    Runway Gen-3, Kling AI, Sora, ElevenLabs, Cursor, GitHub Copilot,
                    LangChain, Prompt Engineering, AI Workflows & Automation
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.8}>
                <div>
                  <h4 className="font-mono text-xs text-accent uppercase tracking-widest mb-3">
                    Video & Creative
                  </h4>
                  <p className="text-sm text-white/50">
                    Premiere Pro, After Effects, DaVinci Resolve, CapCut,
                    Video Editing, Motion Graphics, Thumbnail Design,
                    Content Strategy, Channel Management, Scripting
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
