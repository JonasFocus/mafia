import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mafia — party game",
    short_name: "Mafia",
    description: "A party game of bluffing and deduction. One of you is faking it.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0912",
    theme_color: "#0a0912",
  };
}
