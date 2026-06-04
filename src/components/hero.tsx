"use client";

import { motion } from "framer-motion";
import { TextReveal } from "./reveal";

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-end px-8 pb-16 pt-32">
      {/* Large background text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.03 }}
        transition={{ duration: 2, delay: 1 }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      >
        <span className="text-[20vw] font-black tracking-tighter text-white whitespace-nowrap">
          BUILD
        </span>
      </motion.div>

      <div className="relative z-10 max-w-[1400px] mx-auto w-full">
        <div className="mb-8">
          <TextReveal delay={0.2}>
            <p className="font-mono text-sm text-accent tracking-wide">
              Generative AI — Automation — Content Creation
            </p>
          </TextReveal>
        </div>

        <div className="mb-12">
          <TextReveal delay={0.4}>
            <h1 className="text-[clamp(3rem,8vw,8rem)] font-black leading-[0.9] tracking-tighter">
              Avneesh
            </h1>
          </TextReveal>
          <TextReveal delay={0.5}>
            <h1 className="text-[clamp(3rem,8vw,8rem)] font-black leading-[0.9] tracking-tighter">
              Kumar<span className="text-accent">.</span>
            </h1>
          </TextReveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
          <TextReveal delay={0.7}>
            <p className="text-lg text-white/50 max-w-md leading-relaxed">
              I build AI-powered tools, automate complex workflows, and create
              cinematic content using generative AI. One person. Full pipeline.
              From idea to shipped product — faster than most teams.
            </p>
          </TextReveal>

          <TextReveal delay={0.9}>
            <a
              href="#work"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 text-sm font-medium border border-accent/40 text-accent rounded-full hover:bg-accent/10 transition-all duration-300"
            >
              See my work
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
          </TextReveal>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="flex justify-end"
          >
            <div className="flex flex-col items-end gap-2 text-right">
              <span className="text-sm text-white/30">Based in</span>
              <span className="text-sm text-white/70">Hyderabad, India</span>
              <span className="text-sm text-white/30 mt-2">Scroll</span>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-[1px] h-8 bg-accent/50"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
