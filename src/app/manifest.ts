import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Added to the home screen, the site opens as an app: full screen, sideways, no browser bars.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.brand,
    short_name: site.brand,
    description: "Your free house and the person who lives in it.",
    start_url: "/",
    display: "fullscreen",
    orientation: "landscape",
    background_color: "#dde8ee",
    theme_color: "#dde8ee",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
