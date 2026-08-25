"use client";

import { motion } from "framer-motion";
import { Reveal, TextReveal } from "./reveal";
import { useState } from "react";

interface SkillCategory {
  id: string;
  title: string;
  badge: string;
  description: string;
  skills: string[];
  highlight: string;
}

const skillCategories: SkillCategory[] = [
  {
    id: "languages-db",
    title: "Languages & Databases",
    badge: "Core Data Layer",
    description:
      "Writing performant SQL queries, stored procedures, normalized schemas, and graph traversals for high-throughput transactional and analytical workloads.",
    skills: ["Python", "SQL", "PostgreSQL", "MySQL", "Neo4j (Cypher)"],
    highlight: "Complex joins, CTEs, window functions, and graph cypher pattern matching.",
  },
  {
    id: "data-analytics",
    title: "Data Analytics & Pipelines",
    badge: "ETL & Processing",
    description:
      "End-to-end data ingestion, transformation, automated anomaly detection, and statistical profiling across streaming and batch data sources.",
    skills: [
      "Pandas",
      "NumPy",
      "Data Analysis",
      "Data Visualization",
      "Anomaly Detection",
      "ETL Pipelines",
      "Data Cleaning",
    ],
    highlight: "Built sub-second anomaly detection engines and multi-API aggregators.",
  },
  {
    id: "bi-viz",
    title: "BI & Data Visualization",
    badge: "Reporting & Decision Making",
    description:
      "Designing executive-level Power BI dashboards, DAX measures, and structured analytical models that translate complex tabular data into clear business decisions.",
    skills: [
      "Power BI",
      "DAX Measures",
      "Excel (PivotTables, XLOOKUP, IF/IFS)",
      "Dashboard Development",
      "Analytics Dashboards",
      "Data Storytelling",
    ],
    highlight: "Interactive AML fraud dashboards and live sports performance visuals.",
  },
  {
    id: "machine-learning",
    title: "Machine Learning & Graph Analytics",
    badge: "Predictive Models",
    description:
      "Supervised anomaly detection, tabular classification models, explainable AI with SHAP values, and network graph relationship extraction.",
    skills: [
      "scikit-learn",
      "Machine Learning",
      "SHAP (Explainable AI)",
      "Graph Analytics",
      "Feature Engineering",
      "Model Evaluation",
    ],
    highlight: "SHAP-based transparent fraud explanations and Neo4j graph entity links.",
  },
  {
    id: "ai-engineering",
    title: "AI & Modern Engineering",
    badge: "Production Stack",
    description:
      "Production-ready backend APIs, agentic LLM workflows, automated pipelines, Docker containerization, and continuous integration workflows.",
    skills: [
      "RAG Systems",
      "LLM Tool-Calling",
      "Agentic Workflows",
      "Prompt Engineering",
      "FastAPI",
      "REST APIs",
      "Docker",
      "Git & GitHub Actions",
      "MLflow",
      "CI/CD",
    ],
    highlight: "Autonomous agent dispatch, FastAPI backends, and scheduled GitHub workflows.",
  },
];

export function Skills() {
  const [activeTab, setActiveTab] = useState<string>("all");

  const filteredCategories =
    activeTab === "all"
      ? skillCategories
      : skillCategories.filter((c) => c.id === activeTab);

  return (
    <section id="skills" className="py-28 px-6 md:px-12 bg-bg relative">
      <div className="max-w-[1400px] mx-auto">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <p className="font-mono text-xs text-accent-cyan uppercase tracking-widest mb-3">
                02 — Expertise & Tooling
              </p>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
                Technical<br />
                Skillset<span className="text-accent-cyan">.</span>
              </h2>
            </div>
            <p className="text-sm md:text-base text-white/50 max-w-md">
              A comprehensive toolkit spanning data engineering, statistical analysis,
              business intelligence, and production machine learning workflows.
            </p>
          </div>
        </Reveal>

        {/* Filter buttons */}
        <Reveal delay={0.1}>
          <div className="flex flex-wrap gap-2 mb-10 pb-4 border-b border-border">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-full font-mono text-xs transition-all ${
                activeTab === "all"
                  ? "bg-accent-cyan text-bg font-semibold shadow-md shadow-accent-cyan/20"
                  : "bg-surface border border-border text-white/60 hover:text-white hover:border-white/20"
              }`}
            >
              All Domains ({skillCategories.length})
            </button>
            {skillCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveTab(category.id)}
                className={`px-4 py-2 rounded-full font-mono text-xs transition-all ${
                  activeTab === category.id
                    ? "bg-accent-cyan text-bg font-semibold shadow-md shadow-accent-cyan/20"
                    : "bg-surface border border-border text-white/60 hover:text-white hover:border-white/20"
                }`}
              >
                {category.title}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Skill Category Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map((category, idx) => (
            <Reveal key={category.id} delay={idx * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="p-7 rounded-2xl border border-border bg-surface-card/70 hover:border-accent-cyan/40 hover:bg-surface-card transition-all duration-300 flex flex-col justify-between h-full group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-[11px] px-2.5 py-1 rounded-full bg-surface border border-border text-accent-cyan group-hover:border-accent-cyan/30 transition-colors">
                      {category.badge}
                    </span>
                    <span className="font-mono text-xs text-white/20">
                      0{skillCategories.findIndex((c) => c.id === category.id) + 1}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2.5 group-hover:text-accent-cyan transition-colors">
                    {category.title}
                  </h3>

                  <p className="text-xs text-white/50 leading-relaxed mb-6">
                    {category.description}
                  </p>
                </div>

                <div>
                  {/* Skill Pill tags */}
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {category.skills.map((skill) => (
                      <span
                        key={skill}
                        className="font-mono text-[11px] px-2.5 py-1 rounded-md bg-surface border border-border text-white/80 group-hover:border-accent-cyan/20 group-hover:text-white transition-colors"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Highlight callout */}
                  <div className="pt-3.5 border-t border-border/60 flex items-start gap-2 text-[11px] text-white/40 font-mono">
                    <span className="text-accent-cyan shrink-0">↳</span>
                    <span>{category.highlight}</span>
                  </div>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
