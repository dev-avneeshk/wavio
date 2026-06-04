"use client";

import { motion } from "framer-motion";
import { Magnetic } from "./magnetic";

export function Nav() {
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.5, ease: [0.76, 0, 0.24, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 mix-blend-difference"
    >
      <Magnetic>
        <a href="#" className="text-sm font-medium tracking-tight text-white">
          avneesh kumar
        </a>
      </Magnetic>

      <nav className="flex items-center gap-8">
        <Magnetic>
          <a
            href="#work"
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            work
          </a>
        </Magnetic>
        <Magnetic>
          <a
            href="#about"
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            about
          </a>
        </Magnetic>
        <Magnetic>
          <a
            href="https://instagram.com/lasyly.me"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            content
          </a>
        </Magnetic>
        <Magnetic>
          <a
            href="mailto:dev.avneeshk@gmail.com"
            className="text-sm px-4 py-2 rounded-full border border-white/20 text-white hover:bg-white hover:text-black transition-all duration-300"
          >
            collab
          </a>
        </Magnetic>
      </nav>
    </motion.header>
  );
}
