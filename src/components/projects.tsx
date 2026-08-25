"use client";

import { motion } from "framer-motion";
import { Reveal, TextReveal } from "./reveal";
import { useState } from "react";

interface Project {
  id: string;
  name: string;
  category: string;
  tagline: string;
  period: string;
  role: string;
  description: string;
  bullets: string[];
  metrics: { label: string; value: string }[];
  stack: string[];
  liveUrl?: string;
  githubUrl?: string;
  featured?: boolean;
}

const projectsData: Project[] = [
  {
    id: "01",
    name: "lasyly.me",
    category: "Sports Analytics & Community Platform",
    tagline: "Live multi-sport data aggregation, player-prop trends, and real-time query engine",
    period: "2025 – Present",
    role: "Full-Stack Developer & Data Architect",
    description:
      "A high-throughput sports analytics platform that ingests real-time feeds, computes matchup confidence grades, and delivers interactive visual analytics for players and teams.",
    bullets: [
      "Built a live sports analytics platform integrating multiple APIs (BALLDONTLIE, Prop-Odds, nba_api, YouTube Data API v3) to collect, transform, and analyze player and game data across NBA, tennis, football, and more.",
      "Designed a relational data model and React analytics dashboard for player-prop analysis, live trend tracking, and performance comparison.",
      "Built an adaptive live-data pipeline using Supabase and Node.js to maintain near-real-time updates while reducing unnecessary API requests by ~70%.",
      "Hardened the stack end-to-end (Fastify, Supabase, React Native) and deployed on a high-availability Vercel + Railway + Supabase architecture.",
    ],
    metrics: [
      { label: "API Sources", value: "4+ Integrated" },
      { label: "Live Pipeline", value: "Near Real-Time" },
      { label: "Architecture", value: "Supabase + Fastify" },
    ],
    stack: [
      "React",
      "Node.js",
      "Supabase",
      "Fastify",
      "Python",
      "PostgreSQL",
      "WebSockets",
      "Railway",
      "Vercel",
    ],
    liveUrl: "https://lasyly.me",
    githubUrl: "https://github.com/dev-avneeshk",
    featured: true,
  },
  {
    id: "02",
    name: "Sentinel",
    category: "AML Analytics & Anomaly Detection Platform",
    tagline: "Transaction pattern mining, graph relationship analysis, and SHAP-explained alerts",
    period: "2026",
    role: "Data Analyst & ML Engineer",
    description:
      "An Anti-Money Laundering (AML) investigation platform combining SQL behavioral analytics, supervised ML classifiers, Neo4j graph relationships, and executive Power BI reporting.",
    bullets: [
      "Analyzed transaction and behavioral data using SQL, rule-based detection, and supervised anomaly-detection models to identify suspicious activity patterns.",
      "Built Neo4j graph analytics to uncover relationships between entities and added SHAP-based explanations to interpret model-driven alerts for compliance audits.",
      "Developed Power BI reporting and a FastAPI/Next.js investigation interface to surface anomalies, risk indicators, and investigation results.",
    ],
    metrics: [
      { label: "Graph Engine", value: "Neo4j Cypher" },
      { label: "Explainability", value: "SHAP Values" },
      { label: "BI Layer", value: "Power BI + FastAPI" },
    ],
    stack: [
      "Python",
      "SQL",
      "scikit-learn",
      "Neo4j",
      "Cypher",
      "SHAP",
      "FastAPI",
      "Next.js",
      "Power BI",
    ],
    githubUrl: "https://github.com/dev-avneeshk/sentinel",
    featured: true,
  },
  {
    id: "03",
    name: "City Agent",
    category: "Real-Time Urban Analytics Dashboard",
    tagline: "Smart city traffic & civic anomaly monitoring with automated alert dispatch",
    period: "2026",
    role: "Real-Time Systems & Analytics Lead",
    description:
      "A real-time civic intelligence platform monitoring traffic bottlenecks and environmental anomalies with sub-2s incident alerts. Placed 4th nationally at ByteVerse 1.0 (ICFAI Dehradun).",
    bullets: [
      "Built a real-time dashboard for traffic and civic anomaly monitoring using live API data feeds.",
      "Engineered real-time anomaly detection pipelines processing sensor feeds with under 2-second alert generation.",
      "Placed 4th nationally among 100+ competing teams at ByteVerse 1.0 national hackathon.",
    ],
    metrics: [
      { label: "National Rank", value: "4th / 100+ Teams" },
      { label: "Detection Latency", value: "<2 seconds" },
      { label: "Data Feeds", value: "Live Stream APIs" },
    ],
    stack: [
      "Python",
      "Real-Time ETL",
      "Machine Learning",
      "Live API Feeds",
      "Next.js",
      "Telegram API",
    ],
    liveUrl: "https://cityagent-deh.vercel.app",
    githubUrl: "https://github.com/dev-avneeshk/cityagent_deh",
  },
  {
    id: "04",
    name: "NBA News Telegram Bot",
    category: "Automated News Aggregator & Pipeline",
    tagline: "Scheduled multi-source NBA intelligence scraping and automated broadcast",
    period: "2025",
    role: "Python Automation Engineer",
    description:
      "An automated scraping pipeline collecting NBA trade, injury, and game updates across multiple online sources with instant formatting and scheduled push notifications.",
    bullets: [
      "Built a Python automation tool that scrapes NBA news from multiple sources and auto-posts updates to a Telegram channel on a scheduled pipeline.",
      "Implemented intelligent deduplication and regex-based text extraction to maintain high signal-to-noise ratio with zero manual intervention.",
    ],
    metrics: [
      { label: "Intervention", value: "100% Automated" },
      { label: "Sources", value: "Multi-Feed Scrape" },
      { label: "Channel", value: "Telegram API" },
    ],
    stack: [
      "Python",
      "Web Scraping",
      "BeautifulSoup",
      "Telegram Bot API",
      "Cron Pipelines",
    ],
    githubUrl: "https://github.com/dev-avneeshk/nba-news-telegram-bot",
  },
];

export function Projects() {
  const [selectedId, setSelectedId] = useState<string>("01");

  return (
    <section id="projects" className="py-28 px-6 md:px-12 bg-bg relative">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <p className="font-mono text-xs text-accent-cyan uppercase tracking-widest mb-3">
                03 — Selected Portfolio Work
              </p>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
                Featured<br />
                Platforms<span className="text-accent-cyan">.</span>
              </h2>
            </div>
            <div className="text-right">
              <span className="font-mono text-xs text-white/40 block">
                [ PRODUCTION DATA PIPELINES & ANALYTICS ]
              </span>
              <span className="font-mono text-xs text-accent-cyan">
                {projectsData.length} Platforms Featured
              </span>
            </div>
          </div>
        </Reveal>

        {/* Project Cards List */}
        <div className="space-y-8">
          {projectsData.map((project, idx) => (
            <Reveal key={project.id} delay={idx * 0.08}>
              <div
                className={`p-8 md:p-10 rounded-2xl border transition-all duration-300 ${
                  project.featured
                    ? "border-border/90 bg-surface-card/80 hover:border-accent-cyan/40"
                    : "border-border/70 bg-surface/60 hover:border-border-light"
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left Column: Number, Title, Category */}
                  <div className="lg:col-span-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-mono text-xs text-accent-cyan px-2.5 py-1 rounded bg-surface border border-border">
                        PROJECT {project.id}
                      </span>
                      <span className="font-mono text-xs text-white/30">
                        {project.period}
                      </span>
                    </div>

                    <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2">
                      {project.name}
                    </h3>

                    <p className="font-mono text-xs text-accent-teal mb-3">
                      {project.category}
                    </p>

                    <p className="text-xs text-white/40 font-mono mb-6">
                      Role: <span className="text-white/70">{project.role}</span>
                    </p>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 mb-6">
                      {project.metrics.map((m) => (
                        <div
                          key={m.label}
                          className="p-2.5 rounded-lg bg-surface border border-border/80"
                        >
                          <span className="font-mono text-[10px] text-white/40 block">
                            {m.label}
                          </span>
                          <span className="font-mono text-xs font-bold text-white">
                            {m.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Action Links */}
                    <div className="flex flex-wrap gap-3">
                      {project.liveUrl && (
                        <a
                          href={project.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-accent-cyan to-accent-teal text-bg font-mono text-xs font-semibold hover:opacity-90 transition-all shadow-sm shadow-accent-cyan/20"
                        >
                          <span>Live Platform</span>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="7" y1="17" x2="17" y2="7" />
                            <polyline points="7 7 17 7 17 17" />
                          </svg>
                        </a>
                      )}

                      {project.githubUrl && (
                        <a
                          href={project.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-surface text-white/80 hover:text-white hover:border-accent-cyan/40 font-mono text-xs transition-all"
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="text-white/60"
                          >
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                          </svg>
                          <span>Repository</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Bullets & Tech Stack */}
                  <div className="lg:col-span-8 lg:pl-6 lg:border-l border-border/80">
                    <p className="text-sm md:text-base text-white/80 leading-relaxed mb-6 font-light">
                      {project.description}
                    </p>

                    {/* Bullet Points from CV */}
                    <div className="space-y-3 mb-6">
                      {project.bullets.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-start gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan mt-2 shrink-0" />
                          <p className="text-xs md:text-sm text-white/60 leading-relaxed">
                            {bullet}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Stack tags */}
                    <div className="pt-5 border-t border-border/60">
                      <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest block mb-2.5">
                        Technologies & Libraries Used:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {project.stack.map((tech) => (
                          <span
                            key={tech}
                            className="font-mono text-[11px] px-2.5 py-1 rounded bg-surface border border-border text-white/70 hover:border-accent-cyan/30 hover:text-white transition-colors"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
