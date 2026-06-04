"use client";

import { motion } from "framer-motion";
import { Reveal } from "./reveal";
import { useState } from "react";

const projects = [
  {
    id: "01",
    name: "Lasyly",
    tagline: "Real-time sports analytics platform",
    description:
      "WebSocket ETL pipeline pulling live data from ESPN + 3 sources. ML engine computing hit rates, matchup grades, confidence scores. Full BI dashboard. 10+ sports unified under one query interface.",
    stats: ["~500ms latency", "70% load reduction", "1000+ data points/query"],
    stack: ["Python", "WebSockets", "Scikit-learn", "PostgreSQL", "Next.js"],
    link: "https://lasyly.me",
    year: "2026",
  },
  {
    id: "02",
    name: "CityAgent",
    tagline: "Smart city anomaly detection — 4th/50+ teams",
    description:
      "Real-time ETL ingesting traffic, weather, AQI feeds. Threshold-based anomaly detection in <2s. Automated WhatsApp + Telegram citizen alerts. Built in 24 hours at ICFAI Dehradun Hackathon.",
    stats: ["<2s detection", "3 live feeds", "24hr build"],
    stack: ["Python", "Real-Time ETL", "ML", "Telegram API"],
    link: "https://cityagent-deh.vercel.app",
    year: "2026",
  },
  {
    id: "03",
    name: "Zone",
    tagline: "Full-stack productivity app",
    description:
      "PostgreSQL with RLS, PLpgSQL stored procedures, normalized schema. Next.js + TypeScript frontend on Vercel. Sole developer across all layers.",
    stats: ["v1 + v2 migrations", "Row-level security", "Full-stack"],
    stack: ["Next.js", "TypeScript", "Supabase", "PostgreSQL"],
    link: "https://github.com/dev-avneeshk/zone-app",
    year: "2026",
  },
  {
    id: "04",
    name: "NBA News Bot",
    tagline: "Automated news pipeline → Telegram",
    description:
      "Scrapes NBA.com + 3 sources, delivers real-time updates to Telegram channels. Zero manual intervention. Extensible to any news domain.",
    stats: ["0 manual intervention", "3+ sources", "Continuous"],
    stack: ["Python", "Web Scraping", "Telegram API"],
    link: "https://github.com/dev-avneeshk/nba-news-telegram-bot",
    year: "2025",
  },
];

export function Projects() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section id="work" className="py-32 px-8">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <div className="flex items-baseline justify-between mb-16">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter">
              Selected<br />
              Work<span className="text-accent">.</span>
            </h2>
            <span className="font-mono text-sm text-white/30 hidden md:block">
              ({projects.length} projects)
            </span>
          </div>
        </Reveal>

        <div className="space-y-0">
          {projects.map((project, i) => (
            <Reveal key={project.id} delay={i * 0.05}>
              <motion.a
                href={project.link || "#"}
                target={project.link ? "_blank" : undefined}
                rel="noopener noreferrer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="group block border-t border-border py-10 md:py-14"
              >
                <div className="grid grid-cols-12 gap-4 items-start">
                  {/* Number */}
                  <span className="col-span-1 font-mono text-xs text-white/20 pt-2">
                    {project.id}
                  </span>

                  {/* Name + tagline */}
                  <div className="col-span-11 md:col-span-4">
                    <motion.h3
                      animate={{
                        x: hoveredIndex === i ? 20 : 0,
                      }}
                      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                      className="text-2xl md:text-4xl font-bold tracking-tight group-hover:text-accent transition-colors duration-300"
                    >
                      {project.name}
                    </motion.h3>
                    <p className="text-sm text-white/40 mt-1">
                      {project.tagline}
                    </p>
                  </div>

                  {/* Description - hidden on mobile */}
                  <div className="hidden md:block col-span-4">
                    <p className="text-sm text-white/40 leading-relaxed">
                      {project.description}
                    </p>
                  </div>

                  {/* Stack + year */}
                  <div className="hidden md:flex col-span-3 flex-col items-end gap-3">
                    <span className="font-mono text-xs text-white/20">
                      {project.year}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {project.stack.slice(0, 3).map((tech) => (
                        <span
                          key={tech}
                          className="text-xs font-mono px-2 py-0.5 border border-border rounded text-white/30"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                    {project.link && (
                      <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                        View ↗
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile description */}
                <div className="md:hidden mt-4 ml-[calc(8.33%+1rem)]">
                  <p className="text-sm text-white/40 leading-relaxed">
                    {project.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {project.stack.map((tech) => (
                      <span
                        key={tech}
                        className="text-xs font-mono px-2 py-0.5 border border-border rounded text-white/30"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.a>
            </Reveal>
          ))}
          <div className="border-t border-border" />
        </div>
      </div>
    </section>
  );
}
