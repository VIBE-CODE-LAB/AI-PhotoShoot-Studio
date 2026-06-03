export interface BrandSpecification {
  id: string;
  label: string;
  headingsDisplay: string;
  bodyUi: string;
  fontHex: string;
  backgroundColor: string;
  paletteNotes: string;
  overallLookFeel: string;
}

export const BRAND_SPECIFICATIONS: BrandSpecification[] = [
  {
    id: "tweens",
    label: "Tweens",
    headingsDisplay: "Fraunces",
    bodyUi: "Inter",
    fontHex: "#6F4940",
    backgroundColor: "#F3F0E9",
    paletteNotes: "Cream beige base; warm nude softness; cocoa premium anchor.",
    overallLookFeel: "Minimal premium daily comfort.",
  },
  {
    id: "dressberry",
    label: "Dressberry",
    headingsDisplay: "Cormorant Garamond",
    bodyUi: "Manrope",
    fontHex: "#6B2E43",
    backgroundColor: "#F7F3EE",
    paletteNotes: "Soft ivory base; berry-plum anchor; muted sage accent.",
    overallLookFeel: "Feminine fashion elegance.",
  },
  {
    id: "invisiSoft",
    label: "Invisi-Soft",
    headingsDisplay: "Playfair Display",
    bodyUi: "Plus Jakarta Sans",
    fontHex: "#304C7A",
    backgroundColor: "#F6F8FB",
    paletteNotes: "Cool airy off-white; powder blue-grey base; deep blue anchor.",
    overallLookFeel: "Invisible comfort luxury.",
  },
  {
    id: "souminie",
    label: "Souminie",
    headingsDisplay: "Sora",
    bodyUi: "DM Sans",
    fontHex: "#2D4FA0",
    backgroundColor: "#F5FBFF",
    paletteNotes: "Fresh icy white; aqua-blue softness; rich cobalt anchor.",
    overallLookFeel: "Clean modern lingerie premium.",
  },
  {
    id: "komli",
    label: "Komli",
    headingsDisplay: "Cormorant Infant",
    bodyUi: "Mulish",
    fontHex: "#B62F57",
    backgroundColor: "#FBF4F6",
    paletteNotes: "Blush ivory base; rosy pink warmth; berry anchor.",
    overallLookFeel: "Soft romantic sophistication.",
  },
  {
    id: "joomie",
    label: "Joomie",
    headingsDisplay: "Allura",
    bodyUi: "Work Sans",
    fontHex: "#E21B2D",
    backgroundColor: "#FFF7F5",
    paletteNotes: "Warm ivory base; coral-nude softness; bold red anchor.",
    overallLookFeel: "Playful premium confidence.",
  },
  {
    id: "invisiFit",
    label: "Invisi-fit",
    headingsDisplay: "Bodoni Moda",
    bodyUi: "Albert Sans",
    fontHex: "#7A631B",
    backgroundColor: "#FBF7EE",
    paletteNotes: "Champagne ivory base; sand nude; antique gold anchor.",
    overallLookFeel: "Refined support-led luxury.",
  },
  {
    id: "sztori",
    label: "Sztori",
    headingsDisplay: "Prata",
    bodyUi: "Outfit",
    fontHex: "#B2189B",
    backgroundColor: "#FFF4FB",
    paletteNotes: "Light pink base; vibrant magenta anchor; candy accent.",
    overallLookFeel: "Bold premium storytelling.",
  },
  {
    id: "intimist",
    label: "Intimist",
    headingsDisplay: "Italiana",
    bodyUi: "Onest",
    fontHex: "#7B34C9",
    backgroundColor: "#F8F4FA",
    paletteNotes: "Lilac ivory base; muted mauve softness; royal violet anchor.",
    overallLookFeel: "Sensual calm elegance.",
  },
  {
    id: "sushme",
    label: "Sushme",
    headingsDisplay: "Michroma",
    bodyUi: "Urbanist",
    fontHex: "#B81CB0",
    backgroundColor: "#FFF6FF",
    paletteNotes: "Soft pearl pink base; electric magenta anchor; plum accent.",
    overallLookFeel: "Fashion-forward premium glam.",
  },
  {
    id: "swanz",
    label: "Swanz",
    headingsDisplay: "Marcellus",
    bodyUi: "Libre Franklin",
    fontHex: "#5B2D28",
    backgroundColor: "#FAF7F3",
    paletteNotes: "Warm pearl base; dusty nude softness; cocoa-maroon anchor.",
    overallLookFeel: "Classic premium grace.",
  },
];

export const BRAND_SPECIFICATIONS_BY_ID: Record<string, BrandSpecification> = BRAND_SPECIFICATIONS.reduce(
  (acc, spec) => {
    acc[spec.id] = spec;
    return acc;
  },
  {} as Record<string, BrandSpecification>
);

export const PANTY_ONLY_NEUTRAL_DIRECTION = `
Use a clean minimal e-commerce studio setup.
Background:
Neutral soft ivory/pearl backdrop with no distracting elements.
Lighting:
Balanced soft diffused frontal studio lighting with subtle side fill for accurate product visibility.
`;
