"use client";



const row1Skills = [
  "SQL (PostgreSQL / MySQL)",
  "Python (Pandas / NumPy)",
  "Power BI & DAX",
  "Neo4j & Cypher",
  "Anomaly Detection",
  "ETL Pipelines",
  "Scikit-learn",
  "SHAP Explainability",
  "Graph Analytics",
  "FastAPI",
  "Next.js & React",
  "Supabase",
  "Real-Time WebSockets",
  "Docker",
];

const row2Skills = [
  "Advanced Excel & PivotTables",
  "Dashboard Development",
  "RAG & Agentic Workflows",
  "LLM Tool-Calling",
  "MLflow & CI/CD",
  "Data Modeling & Schema Design",
  "Fastify & Node.js",
  "Git & GitHub Actions",
  "Vercel & Railway Deployment",
  "Statistical Analysis",
  "Data Visualization",
  "Automated Alert Pipelines",
];

export function Marquee() {
  return (
    <section className="py-16 overflow-hidden border-y border-border bg-surface/30">
      <div className="max-w-[1400px] mx-auto px-6 mb-6 flex items-center justify-between">
        <span className="font-mono text-xs text-white/40 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
          Technical Stack & Tools
        </span>
        <span className="font-mono text-xs text-accent-cyan/60 hidden sm:inline">
          Data Engineering · BI · ML
        </span>
      </div>

      {/* Row 1 - Left */}
      <div className="overflow-hidden mb-3.5 flex">
        <div className="animate-marquee-left gap-3.5 flex">
          {[...row1Skills, ...row1Skills].map((skill, i) => (
            <span
              key={i}
              className="px-5 py-2.5 text-xs font-mono border border-border/80 rounded-full bg-surface-card/60 text-white/70 hover:text-accent-cyan hover:border-accent-cyan/40 hover:bg-surface transition-all duration-300 shrink-0"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Row 2 - Right */}
      <div className="overflow-hidden flex">
        <div className="animate-marquee-right gap-3.5 flex">
          {[...row2Skills, ...row2Skills].map((skill, i) => (
            <span
              key={i}
              className="px-5 py-2.5 text-xs font-mono border border-border/80 rounded-full bg-surface-card/60 text-white/70 hover:text-accent-cyan hover:border-accent-cyan/40 hover:bg-surface transition-all duration-300 shrink-0"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
