"use client";

import { motion } from "framer-motion";
import { Reveal, TextReveal } from "./reveal";
import { Magnetic } from "./magnetic";

export function Contact() {
  return (
    <section className="py-32 px-8 bg-surface relative overflow-hidden">
      {/* Large background text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="text-[15vw] font-black tracking-tighter text-white/[0.02] whitespace-nowrap">
          LET&apos;S TALK
        </span>
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        <Reveal>
          <p className="font-mono text-sm text-accent mb-8">
            Let&apos;s collaborate
          </p>
        </Reveal>

        <TextReveal delay={0.2}>
          <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-12">
            Got a project<br />
            in mind<span className="text-accent">?</span>
          </h2>
        </TextReveal>

        <Reveal delay={0.4}>
          <p className="text-lg text-white/40 max-w-lg mb-16">
            Open to collaborations on AI-powered products, automation projects,
            content creation workflows, or anything that involves building something
            new and interesting.
          </p>
        </Reveal>

        <Reveal delay={0.5}>
          <Magnetic strength={0.1}>
            <a
              href="mailto:dev.avneeshk@gmail.com"
              className="inline-block text-3xl md:text-5xl font-bold hover:text-accent transition-colors duration-300 border-b-2 border-white/10 hover:border-accent pb-2"
            >
              dev.avneeshk@gmail.com
            </a>
          </Magnetic>
        </Reveal>

        <Reveal delay={0.6}>
          <div className="flex flex-wrap gap-8 mt-16 pt-16 border-t border-border">
            <a
              href="https://github.com/dev-avneeshk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/40 hover:text-accent hover-line transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/devavneeshk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/40 hover:text-accent hover-line transition-colors"
            >
              LinkedIn
            </a>
            <a
              href="https://instagram.com/lasyly.me"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/40 hover:text-accent hover-line transition-colors"
            >
              Instagram
            </a>
            <a
              href="https://lasyly.me"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/40 hover:text-accent hover-line transition-colors"
            >
              lasyly.me
            </a>
            <a
              href="tel:+916306343200"
              className="text-sm text-white/40 hover:text-accent hover-line transition-colors"
            >
              +91 63063 43200
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.7}>
          <footer className="mt-24 flex items-center justify-between text-xs text-white/20">
            <span>© 2026 Avneesh Kumar</span>
            <span className="font-mono">Hyderabad, India</span>
          </footer>
        </Reveal>
      </div>
    </section>
  );
}
