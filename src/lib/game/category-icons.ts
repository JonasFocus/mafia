export const DEFAULT_CATEGORY_ICON = "🎲";

export const CATEGORY_ICONS: Record<string, string> = {
  Sports: "⚽️",
  Food: "🍕",
  Movies: "🎬",
  Animals: "🦊",
  Travel: "✈️",
  "Fast Food": "🍟",
  "Coffee Orders": "☕️",
  "Dating Apps": "💘",
  "Reality TV": "📺",
  Rappers: "🎤",
  "Pop Stars": "🎶",
  Sitcoms: "🛋️",
  "Video Games": "🎮",
  "Social Media Apps": "📱",
  Sneakers: "👟",
  Superheroes: "🦸",
  Anime: "🍥",
  "Horror Movies": "🔪",
  "Drinking Games": "🍻",
  "College Life": "🎓",
  "Gym & Fitness": "🏋️",
  "Road Trip": "🚗",
  "Music Festivals": "🎪",
  "Late-Night Snacks": "🌙",
  Celebrities: "🌟",
};

export function getCategoryIcon(categoryName: string): string {
  return CATEGORY_ICONS[categoryName] ?? DEFAULT_CATEGORY_ICON;
}
