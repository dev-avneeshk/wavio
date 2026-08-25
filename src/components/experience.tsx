"use client";

import { Reveal } from "./reveal";

const experiences = [
  {
    type: "Work Experience",
    title: "Frontend Developer",
    organization: "SkillBanc",
    location: "Remote",
    period: "Jun 2025 – Jul 2025",
    badge: "Industry Experience",
    bullets: [
      "Built and shipped mobile app UI features using Flutter and Dart, collaborating with backend and design teams on responsive, cross-platform screens and components.",
      "Fixed UI bugs and improved app responsiveness across Android and iOS builds, ensuring consistent high-performance rendering.",
    ],
    tech: ["Flutter", "Dart", "Cross-Platform UI", "Git", "REST APIs"],
  },
];

const education = [
  {
    degree: "Bachelor of Science, Data Analytics",
    institution: "ICFAI Tech",
    location: "Hyderabad, India",
    period: "2023 – 2026",
    badge: "B.Sc. Data Analytics",
    details: [
      "Specialized in Statistical Analysis, Database Management Systems (SQL & NoSQL), Machine Learning, Anomaly Detection, and Big Data Processing.",
      "Awarded academic merit scholarship for entrance test performance.",
      "Elected Captain of the College Basketball Team.",
    ],
    highlights: ["Advanced SQL & RDBMS", "Machine Learning & SHAP", "Graph Theory & Neo4j", "Power BI & DAX", "ETL Systems"],
  },
];

export function Experience() {
  return (
    <section id="experience" className="py-28 px-6 md:px-12 bg-bg relative">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <p className="font-mono text-xs text-accent-cyan uppercase tracking-widest mb-3">
                05 — Experience & Education
              </p>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
                Background &<br />
                Credentials<span className="text-accent-cyan">.</span>
              </h2>
            </div>
            <p className="text-sm md:text-base text-white/50 max-w-md">
              Academic foundation in Data Analytics paired with practical frontend and data engineering experience.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Experience Column */}
          <div className="lg:col-span-6 space-y-8">
            <Reveal>
              <div className="flex items-center gap-3 mb-6">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-cyan" />
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Industry Experience
                </h3>
              </div>
            </Reveal>

            {experiences.map((exp, idx) => (
              <Reveal key={idx} delay={idx * 0.1}>
                <div className="p-8 rounded-2xl border border-border bg-surface-card hover:border-accent-cyan/40 transition-all duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-surface border border-border text-accent-cyan">
                      {exp.badge}
                    </span>
                    <span className="font-mono text-xs text-white/40">
                      {exp.period}
                    </span>
                  </div>

                  <h4 className="text-2xl font-bold text-white mb-1">
                    {exp.title}
                  </h4>

                  <p className="font-mono text-sm text-accent-teal mb-5">
                    {exp.organization} · <span className="text-white/40">{exp.location}</span>
                  </p>

                  <div className="space-y-3 mb-6">
                    {exp.bullets.map((b, bIdx) => (
                      <div key={bIdx} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan mt-2 shrink-0" />
                        <p className="text-xs md:text-sm text-white/60 leading-relaxed">
                          {b}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-border/60 flex flex-wrap gap-1.5">
                    {exp.tech.map((t) => (
                      <span
                        key={t}
                        className="font-mono text-[11px] px-2.5 py-1 rounded bg-surface border border-border text-white/70"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Education Column */}
          <div className="lg:col-span-6 space-y-8">
            <Reveal>
              <div className="flex items-center gap-3 mb-6">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-violet" />
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Formal Education
                </h3>
              </div>
            </Reveal>

            {education.map((edu, idx) => (
              <Reveal key={idx} delay={idx * 0.1}>
                <div className="p-8 rounded-2xl border border-border bg-surface-card hover:border-accent-violet/40 transition-all duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-surface border border-border text-accent-violet">
                      {edu.badge}
                    </span>
                    <span className="font-mono text-xs text-white/40">
                      {edu.period}
                    </span>
                  </div>

                  <h4 className="text-2xl font-bold text-white mb-1">
                    {edu.degree}
                  </h4>

                  <p className="font-mono text-sm text-accent-violet mb-5">
                    {edu.institution} · <span className="text-white/40">{edu.location}</span>
                  </p>

                  <div className="space-y-3 mb-6">
                    {edu.details.map((d, dIdx) => (
                      <div key={dIdx} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-violet mt-2 shrink-0" />
                        <p className="text-xs md:text-sm text-white/60 leading-relaxed">
                          {d}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-border/60 flex flex-wrap gap-1.5">
                    {edu.highlights.map((h) => (
                      <span
                        key={h}
                        className="font-mono text-[11px] px-2.5 py-1 rounded bg-surface border border-border text-white/70"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
