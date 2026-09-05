"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { TextReveal, Reveal } from "./reveal";
import { Magnetic } from "./magnetic";

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center px-6 md:px-12 pt-32 pb-20 overflow-hidden bg-radial-glow">
      {/* Background ambient data grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

      {/* Large faint background watermark */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.025 }}
        transition={{ duration: 2, delay: 0.5 }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      >
        <span className="text-[22vw] font-black tracking-tighter text-white whitespace-nowrap">
          ANALYTICS
        </span>
      </motion.div>

      <div className="relative z-10 max-w-[1400px] mx-auto w-full">
        {/* Main Hero Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center mb-14">
          {/* Left Column: Eyebrow + Headline + Bio + CTAs */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Eyebrow / Meta */}
            <div className="mb-4">
              <Reveal>
                <div className="flex items-center gap-3 text-xs font-mono tracking-widest text-accent-cyan uppercase">
                  <span className="w-2 h-0.5 bg-accent-cyan" />
                  <span>Data Analytics & Engineering</span>
                  <span className="text-white/20">·</span>
                  <span className="text-white/40">ICFAI Tech</span>
                </div>
              </Reveal>
            </div>

            {/* Big Headline */}
            <div className="mb-6">
              <TextReveal delay={0.1}>
                <p className="font-mono text-xs sm:text-sm md:text-base text-accent-cyan tracking-wider uppercase mb-2">
                  Data Analyst · Analytics Engineer · ML Practitioner
                </p>
              </TextReveal>

              <TextReveal delay={0.2}>
                <h1 className="text-[clamp(2.8rem,6.8vw,6.2rem)] font-black leading-[0.92] tracking-tighter text-white">
                  Avneesh
                </h1>
              </TextReveal>
              <TextReveal delay={0.3}>
                <h1 className="text-[clamp(2.8rem,6.8vw,6.2rem)] font-black leading-[0.92] tracking-tighter text-white">
                  Kumar<span className="text-accent-cyan">.</span>
                </h1>
              </TextReveal>
            </div>

            {/* Bio & Intro */}
            <Reveal delay={0.4}>
              <p className="text-base md:text-lg text-white/70 font-light leading-relaxed max-w-xl">
                I build <span className="text-white font-medium">real-time data pipelines</span>,{" "}
                <span className="text-white font-medium">interactive BI dashboards</span>, and{" "}
                <span className="text-white font-medium">graph anomaly detection platforms</span>.
                Transforming high-velocity, complex data into actionable intelligence and explainable machine learning models.
              </p>
            </Reveal>

            {/* CTAs */}
            <Reveal delay={0.5}>
              <div className="flex flex-wrap items-center gap-4 mt-8">
                <Magnetic>
                  <a
                    href="#projects"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-full bg-gradient-to-r from-accent-cyan to-accent-teal text-bg hover:shadow-lg hover:shadow-accent-cyan/25 transition-all duration-300"
                  >
                    View Featured Projects
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </a>
                </Magnetic>

                <Magnetic>
                  <a
                    href="/Avneesh_Kumar_Resume.pdf"
                    download="Avneesh_Kumar_Resume.pdf"
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium border border-border hover:border-accent-cyan/50 text-white/90 bg-surface/80 rounded-full hover:bg-surface-hover transition-all duration-300"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-accent-cyan"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download CV
                  </a>
                </Magnetic>

                <Magnetic>
                  <a
                    href="#terminal"
                    className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-mono text-white/50 hover:text-accent-cyan transition-colors"
                  >
                    <span>$ live_query_test</span>
                    <span className="text-accent-cyan">↗</span>
                  </a>
                </Magnetic>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Portrait Photo starting right at the top */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <Reveal delay={0.3}>
              <div className="relative group w-full max-w-[320px] sm:max-w-[360px] lg:max-w-[380px]">
                {/* Subtle glowing backlight */}
                <div className="absolute -inset-1 bg-gradient-to-r from-accent-cyan/20 to-accent-teal/10 rounded-3xl blur-2xl opacity-40 group-hover:opacity-70 transition duration-500" />

                {/* Image frame */}
                <div className="relative rounded-2xl border border-border bg-surface-card overflow-hidden shadow-2xl">
                  <Image
                    src="/me.webp"
                    alt="Avneesh Kumar"
                    width={800}
                    height={1420}
                    priority
                    className="w-full h-[440px] sm:h-[490px] lg:h-[520px] object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08090d] via-transparent to-transparent opacity-60" />

                  {/* Caption Bar */}
                  <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-surface/85 border border-border/80 backdrop-blur-sm flex items-center justify-between text-xs font-mono">
                    <span className="text-white font-medium">Avneesh Kumar</span>
                    <span className="text-accent-cyan text-[11px]">ICFAI Tech</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="flex items-center justify-between pt-6 border-t border-border/40 text-xs font-mono text-white/40">
          <div className="flex items-center gap-4">
            <span className="text-white/60">Hyderabad, India</span>
            <span>·</span>
            <span className="text-accent-cyan/80">dev.avneeshkumar@gmail.com</span>
          </div>

          <a
            href="#about"
            className="flex items-center gap-2 hover:text-accent-cyan transition-colors"
          >
            <span>SCROLL TO EXPLORE</span>
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-accent-cyan"
            />
          </a>
        </div>
      </div>
    </section>
  );
}
