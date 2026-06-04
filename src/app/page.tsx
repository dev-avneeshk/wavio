import { Hero } from "@/components/hero";
import { Marquee } from "@/components/marquee";
import { Projects } from "@/components/projects";
import { Showcase } from "@/components/showcase";
import { About } from "@/components/about";
import { Experience } from "@/components/experience";
import { Instagram } from "@/components/instagram";
import { Contact } from "@/components/contact";
import { Nav } from "@/components/nav";

export default function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <Marquee />
      <Projects />
      <Showcase />
      <About />
      <Experience />
      <Instagram />
      <Contact />
    </>
  );
}
