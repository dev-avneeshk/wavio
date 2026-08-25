"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Magnetic } from "./magnetic";

const navItems = [
  { name: "About", href: "#about" },
  { name: "Skills", href: "#skills" },
  { name: "Projects", href: "#projects" },
  { name: "Experience", href: "#experience" },
  { name: "Terminal", href: "#terminal" },
  { name: "Achievements", href: "#achievements" },
  { name: "Contact", href: "#contact" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.76, 0, 0.24, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-bg/85 backdrop-blur-md border-b border-border/80 py-3 shadow-lg shadow-black/30"
            : "bg-transparent py-6"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 flex items-center justify-between">
          <Magnetic>
            <a
              href="#"
              className="group flex items-center gap-2 text-sm font-semibold tracking-tight text-white hover:text-accent-cyan transition-colors"
            >
              <span className="font-mono text-xs text-accent-cyan font-bold tracking-wider group-hover:text-white transition-colors">
                AK
              </span>
              <span>·</span>
              <span>avneesh kumar</span>
              <span className="hidden sm:inline-block font-mono text-[11px] px-2 py-0.5 rounded bg-surface border border-border text-white/50 group-hover:text-accent-cyan transition-colors">
                DATA ANALYST
              </span>
            </a>
          </Magnetic>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-7">
            {navItems.map((item, idx) => (
              <Magnetic key={item.name}>
                <a
                  href={item.href}
                  className="font-mono text-xs text-white/60 hover:text-accent-cyan transition-colors tracking-wide flex items-center gap-1 group"
                >
                  <span className="text-white/20 text-[10px] group-hover:text-accent-cyan/50 transition-colors">
                    0{idx + 1}.
                  </span>
                  <span>{item.name.toLowerCase()}</span>
                </a>
              </Magnetic>
            ))}
          </nav>

          {/* Right Action buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <Magnetic>
              <a
                href="/Avneesh_Kumar_Resume.docx"
                download="Avneesh_Kumar_Resume.docx"
                className="font-mono text-xs px-3.5 py-1.5 rounded-full border border-border bg-surface/80 text-white/80 hover:text-white hover:border-accent-cyan/50 hover:bg-surface-hover transition-all flex items-center gap-1.5"
              >
                <svg
                  width="12"
                  height="12"
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
                Resume
              </a>
            </Magnetic>
            <Magnetic>
              <a
                href="mailto:dev.avneeshkumar@gmail.com"
                className="font-mono text-xs px-4 py-1.5 rounded-full bg-gradient-to-r from-accent-cyan to-accent-teal text-bg font-semibold hover:opacity-90 transition-all shadow-md shadow-accent-cyan/20"
              >
                Let&apos;s Talk
              </a>
            </Magnetic>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-white/70 hover:text-white focus:outline-none"
            aria-label="Toggle menu"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {mobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </motion.header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-[60px] z-40 bg-surface border-b border-border p-6 shadow-2xl lg:hidden backdrop-blur-xl"
          >
            <nav className="flex flex-col gap-4">
              {navItems.map((item, idx) => (
                <a
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="font-mono text-sm text-white/80 hover:text-accent-cyan py-1 flex items-center justify-between border-b border-border/50 pb-2"
                >
                  <span className="capitalize">{item.name}</span>
                  <span className="text-white/30 text-xs">0{idx + 1}</span>
                </a>
              ))}
              <div className="pt-2 flex flex-col gap-2">
                <a
                  href="/Avneesh_Kumar_Resume.docx"
                  download="Avneesh_Kumar_Resume.docx"
                  className="w-full text-center font-mono text-xs py-2.5 rounded-lg border border-border bg-surface-card text-white flex items-center justify-center gap-2"
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
                    className="text-accent-cyan"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download CV / Resume
                </a>
                <a
                  href="mailto:dev.avneeshkumar@gmail.com"
                  className="w-full text-center font-mono text-xs py-2.5 rounded-lg bg-gradient-to-r from-accent-cyan to-accent-teal text-bg font-bold"
                >
                  Get In Touch
                </a>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
