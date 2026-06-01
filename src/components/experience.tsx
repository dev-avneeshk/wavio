"use client";

import { Reveal } from "./reveal";

const experiences = [
  {
    period: "Jan – Jun 2025",
    role: "Frontend Developer Intern",
    company: "Skillbanc",
    description:
      "Shipped 4+ production UI components across 3 sprints. Analyzed user interaction data to redesign auth flow. Cross-functional team of 8+.",
  },
];

const certs = [
  { name: "Data Analytics Virtual Experience", org: "Deloitte", year: "2026" },
  { name: "Analytics Consulting Virtual Internship", org: "KPMG", year: "2026" },
];

export function Experience() {
  return (
    <section className="py-32 px-8">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-20">
            Experience<span className="text-accent">.</span>
          </h2>
        </Reveal>

        {/* Work */}
        <div className="mb-20">
          {experiences.map((exp, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-8 border-b border-border">
                <div className="md:col-span-3">
                  <span className="font-mono text-sm text-white/30">
                    {exp.period}
                  </span>
                </div>
                <div className="md:col-span-9">
                  <h3 className="text-xl font-semibold mb-1">
                    {exp.role}{" "}
                    <span className="text-white/40 font-normal">
                      @ {exp.company}
                    </span>
                  </h3>
                  <p className="text-sm text-white/40 leading-relaxed">
                    {exp.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Certs */}
        <Reveal>
          <h3 className="font-mono text-xs text-accent uppercase tracking-widest mb-8">
            Certifications
          </h3>
        </Reveal>
        <div className="space-y-4">
          {certs.map((cert, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div className="flex items-center justify-between py-4 border-b border-border">
                <div>
                  <span className="text-base font-medium">{cert.name}</span>
                  <span className="text-white/30 ml-3 text-sm">
                    — {cert.org}
                  </span>
                </div>
                <span className="font-mono text-xs text-white/20">
                  {cert.year}
                </span>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Education */}
        <Reveal delay={0.2}>
          <div className="mt-16 p-8 border border-border rounded-xl bg-surface">
            <h3 className="font-mono text-xs text-accent uppercase tracking-widest mb-4">
              Education
            </h3>
            <h4 className="text-lg font-semibold">
              B.Sc. Data Analytics
            </h4>
            <p className="text-sm text-white/40 mt-1">
              ICFAI Tech Hyderabad — 2023–2026
            </p>
            <p className="text-xs text-white/30 mt-2">
              Relevant: Data Structures & Algorithms, Statistical Analysis,
              Database Management, Machine Learning, Data Visualization
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
