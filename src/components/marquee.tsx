"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const row1Skills = [
  "Python",
  "SQL",
  "ETL Pipelines",
  "WebSockets",
  "Generative AI",
  "ChatGPT",
  "Midjourney",
  "Runway",
  "Scikit-learn",
  "PostgreSQL",
  "Cursor",
  "Prompt Engineering",
  "Video Editing",
  "Next.js",
  "TypeScript",
  "LangChain",
];

const row2Skills = [
  "Premiere Pro",
  "ElevenLabs",
  "Machine Learning",
  "Claude",
  "Real-Time Systems",
  "Power BI",
  "Tableau",
  "DALL·E",
  "After Effects",
  "Pandas",
  "Kling AI",
  "Content Strategy",
  "DaVinci Resolve",
  "GitHub Copilot",
  "Statistical Analysis",
  "Stable Diffusion",
];

export function Marquee() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const x1 = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const x2 = useTransform(scrollYProgress, [0, 1], ["-30%", "0%"]);

  return (
    <section
      ref={ref}
      className="py-24 overflow-hidden border-y border-border"
    >
      <motion.div style={{ x: x1 }} className="flex gap-4 mb-4 whitespace-nowrap">
        {[...row1Skills, ...row1Skills].map((skill, i) => (
          <span
            key={i}
            className="px-6 py-3 text-sm font-mono border border-border rounded-full text-white/60 hover:text-accent hover:border-accent/30 transition-colors duration-300 shrink-0"
          >
            {skill}
          </span>
        ))}
      </motion.div>
      <motion.div style={{ x: x2 }} className="flex gap-4 whitespace-nowrap">
        {[...row2Skills, ...row2Skills].map((skill, i) => (
          <span
            key={i}
            className="px-6 py-3 text-sm font-mono border border-border rounded-full text-white/60 hover:text-accent hover:border-accent/30 transition-colors duration-300 shrink-0"
          >
            {skill}
          </span>
        ))}
      </motion.div>
    </section>
  );
}
