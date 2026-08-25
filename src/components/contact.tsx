"use client";

import { motion } from "framer-motion";
import { Reveal, TextReveal } from "./reveal";
import { Magnetic } from "./magnetic";
import { CheckIcon } from "./icons";
import { useState } from "react";

export function Contact() {
  const [copied, setCopied] = useState(false);
  const [formState, setFormState] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("dev.avneeshkumar@gmail.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.email || !formState.message) return;
    setSubmitted(true);
    setTimeout(() => {
      // open mailto as fallback
      window.location.href = `mailto:dev.avneeshkumar@gmail.com?subject=Contact from ${encodeURIComponent(
        formState.name || "Portfolio Visitor"
      )}&body=${encodeURIComponent(formState.message)}`;
    }, 400);
  };

  return (
    <section id="contact" className="py-28 px-6 md:px-12 bg-bg relative overflow-hidden">
      {/* Background large text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="text-[16vw] font-black tracking-tighter text-white/[0.015] whitespace-nowrap">
          LET&apos;S CONNECT
        </span>
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        <Reveal>
          <div className="mb-12">
            <p className="font-mono text-xs text-accent-cyan uppercase tracking-widest mb-3">
              07 — Get In Touch
            </p>
            <h2 className="text-4xl md:text-7xl font-black tracking-tighter text-white">
              Let&apos;s Build Data<br />
              Intelligence<span className="text-accent-cyan">.</span>
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Direct info & Copy Email */}
          <div className="lg:col-span-6 space-y-8">
            <Reveal delay={0.2}>
              <p className="text-base md:text-lg text-white/60 leading-relaxed max-w-md">
                I am actively seeking <span className="text-white">Data Analyst</span> and{" "}
                <span className="text-white">Analytics Engineering</span> opportunities.
                Whether you have a role opening, an interesting data pipeline challenge, or a hackathon project, let&apos;s talk.
              </p>
            </Reveal>

            {/* Email Box */}
            <Reveal delay={0.3}>
              <div className="p-6 rounded-2xl border border-border bg-surface-card max-w-md">
                <span className="font-mono text-xs text-white/40 block mb-2">
                  PRIMARY EMAIL
                </span>
                <div className="flex items-center justify-between gap-3">
                  <a
                    href="mailto:dev.avneeshkumar@gmail.com"
                    className="font-mono text-sm md:text-base text-white font-bold hover:text-accent-cyan transition-colors truncate"
                  >
                    dev.avneeshkumar@gmail.com
                  </a>
                  <button
                    onClick={handleCopyEmail}
                    className="font-mono text-xs px-3 py-1.5 rounded-lg border border-border bg-surface text-white/70 hover:text-accent-cyan hover:border-accent-cyan/40 transition-all shrink-0 flex items-center gap-1.5"
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5 text-accent-emerald" />
                        <span className="text-accent-emerald">Copied</span>
                      </>
                    ) : (
                      "Copy"
                    )}
                  </button>
                </div>
              </div>
            </Reveal>

            {/* Phone Box */}
            <Reveal delay={0.35}>
              <div className="p-6 rounded-2xl border border-border bg-surface-card max-w-md">
                <span className="font-mono text-xs text-white/40 block mb-2">
                  PHONE & WHATSAPP
                </span>
                <div className="flex items-center justify-between">
                  <a
                    href="tel:+916306343200"
                    className="font-mono text-sm md:text-base text-white font-bold hover:text-accent-cyan transition-colors"
                  >
                    +91 63063 43200
                  </a>
                  <a
                    href="tel:+916306343200"
                    className="font-mono text-xs px-3 py-1.5 rounded-lg border border-border bg-surface text-white/70 hover:text-accent-cyan hover:border-accent-cyan/40 transition-all"
                  >
                    Call
                  </a>
                </div>
              </div>
            </Reveal>

            {/* Resume Download CTA */}
            <Reveal delay={0.4}>
              <div className="pt-2">
                <a
                  href="/Avneesh_Kumar_Resume.docx"
                  download="Avneesh_Kumar_Resume.docx"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-surface border border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/10 font-mono text-xs transition-all"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download Complete Resume (.docx)</span>
                </a>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Quick Contact Form */}
          <div className="lg:col-span-6">
            <Reveal delay={0.3}>
              <div className="p-8 rounded-2xl border border-border bg-surface-card shadow-xl">
                <h3 className="text-xl font-bold text-white mb-2">
                  Send a Direct Message
                </h3>
                <p className="text-xs text-white/40 font-mono mb-6">
                  Fill this out to shoot me an email directly.
                </p>

                {submitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 rounded-xl bg-accent-emerald/10 border border-accent-emerald/30 text-center space-y-2"
                  >
                    <div className="w-10 h-10 mx-auto rounded-full bg-accent-emerald/20 flex items-center justify-center text-accent-emerald mb-2">
                      <CheckIcon className="w-5 h-5" />
                    </div>
                    <h4 className="font-mono text-sm font-bold text-accent-emerald">
                      Opening Your Mail Client
                    </h4>
                    <p className="text-xs text-white/60">
                      Redirecting to dev.avneeshkumar@gmail.com with your message!
                    </p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="font-mono text-xs text-white/40 block mb-1.5">
                        Your Name
                      </label>
                      <input
                        type="text"
                        value={formState.name}
                        onChange={(e) =>
                          setFormState({ ...formState, name: e.target.value })
                        }
                        placeholder="Sarah Jenkins"
                        className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-white text-sm focus:outline-none focus:border-accent-cyan font-sans transition-colors placeholder:text-white/20"
                      />
                    </div>

                    <div>
                      <label className="font-mono text-xs text-white/40 block mb-1.5">
                        Your Email
                      </label>
                      <input
                        type="email"
                        required
                        value={formState.email}
                        onChange={(e) =>
                          setFormState({ ...formState, email: e.target.value })
                        }
                        placeholder="sarah@company.com"
                        className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-white text-sm focus:outline-none focus:border-accent-cyan font-sans transition-colors placeholder:text-white/20"
                      />
                    </div>

                    <div>
                      <label className="font-mono text-xs text-white/40 block mb-1.5">
                        Message / Role Details
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={formState.message}
                        onChange={(e) =>
                          setFormState({ ...formState, message: e.target.value })
                        }
                        placeholder="Hi Avneesh, we would love to connect with you regarding a Data Analyst role..."
                        className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-white text-sm focus:outline-none focus:border-accent-cyan font-sans transition-colors placeholder:text-white/20"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-teal text-bg font-mono text-xs font-bold hover:opacity-90 transition-all shadow-md shadow-accent-cyan/20"
                    >
                      Send Message →
                    </button>
                  </form>
                )}
              </div>
            </Reveal>
          </div>
        </div>

        {/* Social / Directory Links */}
        <Reveal delay={0.5}>
          <div className="flex flex-wrap items-center justify-between gap-4 mt-20 pt-10 border-t border-border/80">
            <div className="flex flex-wrap items-center gap-6">
              <a
                href="https://github.com/dev-avneeshk"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-white/50 hover:text-accent-cyan transition-colors"
              >
                GitHub [dev-avneeshk]
              </a>
              <a
                href="https://linkedin.com/in/devavneeshk"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-white/50 hover:text-accent-cyan transition-colors"
              >
                LinkedIn
              </a>
              <a
                href="https://lasyly.me"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-white/50 hover:text-accent-cyan transition-colors"
              >
                lasyly.me
              </a>
              <a
                href="https://wavio.codes"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-white/50 hover:text-accent-cyan transition-colors"
              >
                wavio.codes
              </a>
            </div>

            <span className="font-mono text-xs text-white/30">
              Hyderabad, Telangana, India
            </span>
          </div>
        </Reveal>

        {/* Footer */}
        <Reveal delay={0.6}>
          <footer className="mt-12 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-white/20 gap-3">
            <span>© {new Date().getFullYear()} Avneesh Kumar · Data Analyst</span>
            <span>Built with Next.js 15, TypeScript & TailwindCSS</span>
          </footer>
        </Reveal>
      </div>
    </section>
  );
}
