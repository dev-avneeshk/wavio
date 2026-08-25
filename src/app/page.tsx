import { Hero } from "@/components/hero";
import { Marquee } from "@/components/marquee";
import { About } from "@/components/about";
import { Skills } from "@/components/skills";
import { Projects } from "@/components/projects";
import { QuerySimulator } from "@/components/query-simulator";
import { Experience } from "@/components/experience";
import { Achievements } from "@/components/achievements";
import { Contact } from "@/components/contact";
import { Nav } from "@/components/nav";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg text-slate-100 flex flex-col selection:bg-accent-cyan/20 selection:text-accent-cyan">
      <Nav />
      <Hero />
      <Marquee />
      <About />
      <Skills />
      <Projects />
      <QuerySimulator />
      <Experience />
      <Achievements />
      <Contact />
    </main>
  );
}
