import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mafia & Chameleon",
    short_name: "Mafia",
    description: "Two phone-first party games of bluffing, deduction, and hidden roles.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070506",
    theme_color: "#070506",
    lang: "en",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Host a game",
        short_name: "Host",
        description: "Create a room for Mafia or Chameleon.",
        url: "/host",
      },
      {
        name: "Join a game",
        short_name: "Join",
        description: "Join friends with a four-character room code.",
        url: "/join",
      },
    ],
  };
}
