"use client";

import { Reveal } from "./reveal";

const corePillars = [
  {
    title: "Relational & Graph Architecture",
    description: "Designing normalized PostgreSQL schemas, query optimization, indexing, and multi-hop Neo4j Cypher traversals for entity link analysis.",
    tag: "SQL & Cypher",
  },
  {
    title: "Real-Time ETL & Stream Processing",
    description: "Building resilient pipelines connecting live APIs (BALLDONTLIE, NBA API, WebSockets) with sub-2-second event processing and automatic failover.",
    tag: "Event Streams",
  },
  {
    title: "Explainable Machine Learning",
    description: "Applying supervised classification, anomaly detection algorithms, and SHAP value explainability so compliance teams understand every alert.",
    tag: "SHAP & ML",
  },
  {
    title: "Executive BI & Decision Dashboards",
    description: "Crafting intuitive Power BI, Next.js, and React dashboards equipped with DAX metrics and dynamic filters for instant executive decision-making.",
    tag: "Power BI & DAX",
  },
];

export function About() {
  return (
    <section id="about" className="py-28 px-6 md:px-12 bg-surface/40 relative">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <p className="font-mono text-xs text-accent-cyan uppercase tracking-widest mb-3">
                01 — Professional Narrative
              </p>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
                About<br />
                Avneesh<span className="text-accent-cyan">.</span>
              </h2>
            </div>
            <div className="font-mono text-xs text-white/40 max-w-xs text-left md:text-right">
              [ B.SC. DATA ANALYTICS @ ICFAI TECH ]<br />
              <span className="text-accent-cyan">HYDERABAD, INDIA</span>
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Main Story Text */}
          <div className="lg:col-span-7 space-y-6">
            <Reveal delay={0.1}>
              <p className="text-xl md:text-2xl text-white/80 leading-relaxed font-light">
                I am a <span className="text-white font-medium">Data Analyst and Analytics Engineer</span> passionate about bridging the gap between raw data streams and actionable business intelligence.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="text-sm md:text-base text-white/60 leading-relaxed">
                Currently pursuing my <span className="text-white">Bachelor of Science in Data Analytics at ICFAI Tech (2023–2026)</span>, I combine strong statistical foundations with hands-on software engineering. I don&apos;t just build static reports; I engineer automated data pipelines, real-time ingestion backends, and machine learning systems that run continuously in production.
              </p>
            </Reveal>

            <Reveal delay={0.3}>
              <p className="text-sm md:text-base text-white/60 leading-relaxed">
                My work spans sports analytics (<span className="text-accent-cyan font-mono text-xs">lasyly.me</span>), Anti-Money Laundering transaction fraud detection (<span className="text-accent-cyan font-mono text-xs">Sentinel</span>), and civic anomaly monitoring (<span className="text-accent-cyan font-mono text-xs">City Agent</span>, placed 4th nationally at ByteVerse 1.0). Whether it&apos;s writing high-performance SQL window queries, building Neo4j graph traversals to unmask money mule rings, or computing SHAP explanations for predictive models, I build solutions engineered for scale and clarity.
              </p>
            </Reveal>

            {/* Quick summary points */}
            <Reveal delay={0.4}>
              <div className="p-6 rounded-xl border border-border bg-surface-card/80 mt-8">
                <h4 className="font-mono text-xs text-accent-cyan uppercase tracking-widest mb-4">
                  Quick Profile Snapshot
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono text-white/70">
                  <div>
                    <span className="text-white/30 block mb-1">CURRENT STATUS</span>
                    <span className="text-white">B.Sc. Data Analytics (ICFAI Tech)</span>
                  </div>
                  <div>
                    <span className="text-white/30 block mb-1">LOCATION</span>
                    <span className="text-white">Hyderabad, India (Open to Remote/Relocation)</span>
                  </div>
                  <div>
                    <span className="text-white/30 block mb-1">PRIMARY DOMAINS</span>
                    <span className="text-white">SQL · Python · Power BI · Graph ML · ETL</span>
                  </div>
                  <div>
                    <span className="text-white/30 block mb-1">CONTACT CHANNELS</span>
                    <span className="text-accent-cyan">dev.avneeshkumar@gmail.com</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Pillars Column */}
          <div className="lg:col-span-5 space-y-4">
            <Reveal delay={0.2}>
              <h3 className="font-mono text-xs text-white/40 uppercase tracking-widest mb-6">
                Core Architectural Pillars
              </h3>
            </Reveal>

            {corePillars.map((pillar, idx) => (
              <Reveal key={pillar.title} delay={0.2 + idx * 0.06}>
                <div className="p-5 rounded-xl border border-border bg-surface-card/60 hover:border-accent-cyan/30 hover:bg-surface-card transition-colors duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-white tracking-tight">
                      {pillar.title}
                    </h4>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface border border-border text-accent-cyan">
                      {pillar.tag}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
