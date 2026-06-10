import promptsTxt from "../Prompts.txt?raw";
import pushupPromptsTxt from "../Pushup Prompt.txt?raw";
import braOnlyPromptsTxt from "../Bra Prompt.txt?raw";
import pushupBraOnlyPromptsTxt from "../Pushup-Bra-Only-Prompt.txt?raw";
import type { BrandSpecification } from "./brandSpecifications";
import type { CalloutZone, ImageCalloutsContent } from "../types";

// ========================================
// ZONE TAG SYSTEM
// Each zone maps to: (1) an icon illustration the AI will draw,
// (2) the exact bra zone the callout pointer will target.
// ========================================

interface ZoneSpec {
  iconDescription: string;
  pointsTo: string;
}

const ZONE_LOOKUP: Record<Exclude<CalloutZone, 'auto'>, ZoneSpec> = {
  armhole: {
    iconDescription:
      "a curved open arc representing the underarm/armhole gap of a bra — like a rounded parenthesis shape open at the bottom, showing the clean wing opening",
    pointsTo: "armhole edge",
  },
  band: {
    iconDescription:
      "a flat wide horizontal rectangle strip — a clean elongated band representing the bra bottom band sitting below the cups",
    pointsTo: "bottom band of bra",
  },
  strap: {
    iconDescription:
      "a diagonal line with a small rectangular slider/adjuster midway — representing an adjustable shoulder strap viewed from front",
    pointsTo: "shoulder strap",
  },
  hook: {
    iconDescription:
      "three horizontal rows of hook-and-eye closure pairs — a 3-row by 2-column grid of small hooks, as seen from the back of a bra",
    pointsTo: "hook-and-eye closure at center back band",
  },
  wing: {
    iconDescription:
      "a broad wide flat panel shape with smooth rounded edges — representing the bra side wing panel at the flank/underarm zone",
    pointsTo: "side wing panel at flank",
  },
  fabric: {
    iconDescription:
      "an open breathable weave lattice — a small grid or mesh of crossed threads representing breathable cotton fabric construction",
    pointsTo: "fabric surface panel",
  },
  padding: {
    iconDescription:
      "a curved foam-lift arc layer shown inside a cup outline — the arc rises from below showing internal padding that lifts the cup upward",
    pointsTo: "cup padding area",
  },
  gripper: {
    iconDescription:
      "a horizontal band with small evenly spaced texture dots — representing a silicone anti-slip gripper or internal grip strip",
    pointsTo: "inner band lining",
  },
  w_hold: {
    iconDescription:
      "two curved cup arcs forming a W or double-arc structure side by side — representing the W-hold wire-free support system",
    pointsTo: "front center panel",
  },
  vneck: {
    iconDescription:
      "two diagonal lines converging to a center lower point — forming a clean V-neckline shape between bra cups",
    pointsTo: "V-neckline between cups",
  },
  coverage: {
    iconDescription:
      "a tall rounded rectangle panel outline — representing a full-coverage bra front panel with smooth edges",
    pointsTo: "full front coverage panel",
  },
  u_back: {
    iconDescription:
      "two parallel vertical straps curving down and meeting at a single center point — forming a U-shape as seen from the back of a bra",
    pointsTo: "U-back junction at center back",
  },
  spillage: {
    iconDescription:
      "a smooth oval panel with a neat boundary line along its edge — representing a contained side panel with no overflow or side bulge",
    pointsTo: "side panel / side seam area",
  },
};

// Detect zone from callout text keywords. Falls back to 'fabric' if no keyword matches.
const detectZoneFromText = (
  text: string,
  explicit?: CalloutZone
): Exclude<CalloutZone, 'auto'> => {
  if (explicit && explicit !== 'auto') return explicit as Exclude<CalloutZone, 'auto'>;
  const lower = text.toLowerCase();
  if (/armhole|underarm|arm[\s-]*hole|rash[\s-]*free/.test(lower)) return 'armhole';
  if (/bottom[\s-]*band|bra[\s-]*band|underbust|elastic[\s-]*free[\s-]*band/.test(lower)) return 'band';
  if (/strap|shoulder[\s-]*strap|spaghetti/.test(lower)) return 'strap';
  if (/hook|closure|3[\s-]*level|adjustable[\s-]*hook/.test(lower)) return 'hook';
  if (/wing|side[\s-]*wing|back[\s-]*smooth|smoothen/.test(lower)) return 'wing';
  if (/cotton|breathabl|fabric|weave|airy|knit/.test(lower)) return 'fabric';
  if (/pad|lift|push[\s-]*up|cushion/.test(lower)) return 'padding';
  if (/grip|gripper|anti[\s-]*slip/.test(lower)) return 'gripper';
  if (/w[\s-]*hold|wire[\s-]*free|wire free/.test(lower)) return 'w_hold';
  if (/v[\s-]*neck|neckline|v[\s-]*shape/.test(lower)) return 'vneck';
  if (/coverage|full[\s-]*cover/.test(lower)) return 'coverage';
  if (/u[\s-]*back/.test(lower)) return 'u_back';
  if (/spill|bulge|side[\s-]*bulge/.test(lower)) return 'spillage';
  return 'fabric';
};

// ========================================
// CALLOUT OVERRIDE BLOCK BUILDERS
// These are appended at the END of each prompt, explicitly overriding
// any hardcoded icon descriptions earlier in the Prompts.txt sections.
// ========================================

interface ResolvedCallout {
  feature: string;
  benefit: string;
  zone: Exclude<CalloutZone, 'auto'>;
}

const resolveCallout = (pair: [string, string], explicit?: CalloutZone): ResolvedCallout => ({
  feature: pair[0],
  benefit: pair[1],
  zone: detectZoneFromText(`${pair[0]} ${pair[1]}`, explicit),
});

const formatCalloutEntry = (
  index: number,
  callout: ResolvedCallout,
  position: string,
  lineInstruction: string,
  brand: BrandSpecification
): string => {
  const spec = ZONE_LOOKUP[callout.zone];
  const lines = [
    `CALLOUT ${index + 1} — ${position}`,
    `Feature text: "${callout.feature}"`,
    `Feature font/color lock: bold ${brand.headingsDisplay}, exact color ${brand.fontHex}. Every feature glyph must be ${brand.fontHex}; no black, charcoal, gray, or alternate color.`,
  ];
  if (callout.benefit) {
    lines.push(
      `Benefit text: "${callout.benefit}"`,
      `Benefit font/color lock: regular ${brand.bodyUi}, exact color ${brand.fontHex}. Every benefit glyph must be ${brand.fontHex}; no black, charcoal, gray, or alternate color.`
    );
  }
  lines.push(
    `Points to: ${spec.pointsTo}`,
    `Line: ${lineInstruction}`,
    `Placement safety: icon circle and all callout text must sit only in clean background/negative space. They must not overlap model skin, face, hair, bra, panty, straps, body silhouette, or product fabric. Keep at least 24px clear space from skin and garment edges.`,
    `Icon illustration: ${spec.iconDescription}`,
    `Icon style: ~42px circular | Fill solid ${brand.fontHex} | White interior line art only, zero solid fills inside | Thin ${brand.fontHex} border ring`
  );
  return lines.join('\n');
};

const formatCalloutEntryNoIcon = (
  index: number,
  callout: ResolvedCallout,
  position: string,
  lineInstruction: string,
  brand: BrandSpecification
): string => {
  const spec = ZONE_LOOKUP[callout.zone];
  const lines = [
    `CALLOUT ${index + 1} — ${position}`,
    `Feature text: "${callout.feature}"`,
    `Feature font/color lock: bold ${brand.headingsDisplay}, exact color ${brand.fontHex}. Every feature glyph must be ${brand.fontHex}; no black, charcoal, gray, or alternate color.`,
  ];
  if (callout.benefit) {
    lines.push(
      `Benefit text: "${callout.benefit}"`,
      `Benefit font/color lock: regular ${brand.bodyUi}, exact color ${brand.fontHex}. Every benefit glyph must be ${brand.fontHex}; no black, charcoal, gray, or alternate color.`
    );
  }
  lines.push(
    `Points to: ${spec.pointsTo}`,
    `Line: ${lineInstruction}`,
    `Placement safety: callout text and any 4px dot must sit only in clean background/negative space. They must not overlap model skin, face, hair, bra, panty, straps, body silhouette, or product fabric. Keep at least 24px clear space from skin and garment edges.`,
    `Icon rule: DO NOT RENDER ICON ILLUSTRATIONS — omit circular icon graphics. If a marker is required, render a 4px dot only, placed outside product edge and away from skin.`
  );
  return lines.join('\n');
};

const OVERRIDE_HEADER = `
═══════════════════════════════════════════════════════
MANDATORY CALLOUT OVERRIDE — SUPERSEDES ALL CALLOUT ICON DESCRIPTIONS ABOVE
═══════════════════════════════════════════════════════
These callout specifications are FINAL. Use the icon illustrations described below exactly — ignore any icon description that appeared earlier in this prompt.
Line rule: thin 1px straight line, color as specified, no arrowheads, no curves, lines must NOT cross each other.
Icon rule: ~42px circular, solid color fill, white interior line art only, thin border ring — no solid fills inside the icon.
CALLOUT TEXT COLOR RULE: every visible callout word, both feature line and benefit line, must use the selected brand font hex exactly. Do NOT render callout text in black, dark gray, charcoal, or browser/default text color.
CALLOUT PLACEMENT RULE: icons, text blocks, and decorative circles must remain fully outside the model/body/product silhouette. No icon or text may sit on skin, face, hair, bra, panty, straps, or product fabric. Use background/negative space only.
`.trim();

const buildOverrideFooter = (brand: BrandSpecification): string =>
  [
    `FINAL CALLOUT BRAND LOCK:`,
    `All callout feature text: ${brand.headingsDisplay}, bold, ${brand.fontHex} only.`,
    `All callout benefit text: ${brand.bodyUi}, regular, ${brand.fontHex} only.`,
    `All callout lines, dots, icon fills, and icon borders: ${brand.fontHex} only.`,
    `Never use black (#000000), near-black, gray, charcoal, or any non-${brand.fontHex} color for callout text.`,
    `END OF CALLOUT OVERRIDE.`,
  ].join('\n');

const buildSideView1Override = (
  callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout],
  brand: BrandSpecification
): string =>
  [
    OVERRIDE_HEADER,
    formatCalloutEntry(
      0, callouts[0],
      'RIGHT SIDE of image, at mid-torso height',
      `thin 1px ${brand.fontHex} straight line runs from icon LEFT toward the bra zone and stops at the garment edge; line stays outside skin/product surface except for the precise endpoint`,
      brand
    ),
    formatCalloutEntry(
      1, callouts[1],
      'BOTTOM LEFT of image, at bra band level',
      `thin 1px ${brand.fontHex} slightly angled line runs from icon toward the bra bottom band edge; line stays outside skin/product surface except for the precise endpoint`,
      brand
    ),
    formatCalloutEntry(
      2, callouts[2],
      'LEFT SIDE of image, at mid-torso height',
      `thin 1px ${brand.fontHex} straight line runs from icon RIGHT toward the bra zone and stops at the garment edge; line stays outside skin/product surface except for the precise endpoint`,
      brand
    ),
    buildOverrideFooter(brand),
  ].join('\n\n');

const buildSideView2Override = (
  callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout],
  brand: BrandSpecification
): string =>
  [
    OVERRIDE_HEADER,
    'LAYOUT: 3 feature icons stacked VERTICALLY on LEFT SIDE only. NO callout pointer lines — icons stand independently.',
    formatCalloutEntry(
      0, callouts[0],
      'LEFT SIDE — upper stack position (NO pointer line)',
      'none — this icon stands alone, no connecting line to bra',
      brand
    ),
    formatCalloutEntry(
      1, callouts[1],
      'LEFT SIDE — middle stack position (NO pointer line)',
      'none — this icon stands alone, no connecting line to bra',
      brand
    ),
    formatCalloutEntry(
      2, callouts[2],
      'LEFT SIDE — lower stack position (NO pointer line)',
      'none — this icon stands alone, no connecting line to bra',
      brand
    ),
    buildOverrideFooter(brand),
  ].join('\n\n');

const buildBackViewOverride = (
  callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout],
  brand: BrandSpecification
): string =>
  [
    OVERRIDE_HEADER,
    'All 3 callouts stack on RIGHT SIDE pointing LEFT into the bra back construction zones. LEFT side stays clean.',
    formatCalloutEntry(
      0, callouts[0],
      'TOP RIGHT of image, at upper back / U-back strap height',
      `thin 1px ${brand.fontHex} straight line runs from icon LEFT toward bra back upper edge; line stays outside skin/product surface except for the precise endpoint`,
      brand
    ),
    formatCalloutEntry(
      1, callouts[1],
      'RIGHT SIDE of image, at center back / hook closure height',
      `thin 1px ${brand.fontHex} straight line runs from icon LEFT toward center back edge; line stays outside skin/product surface except for the precise endpoint`,
      brand
    ),
    formatCalloutEntry(
      2, callouts[2],
      'BOTTOM RIGHT of image, at side wing / flank height',
      `thin 1px ${brand.fontHex} straight line runs from icon LEFT toward side wing edge; line stays outside skin/product surface except for the precise endpoint`,
      brand
    ),
    buildOverrideFooter(brand),
  ].join('\n\n');

const buildMoodViewOverride = (
  callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout, ResolvedCallout],
  brand: BrandSpecification
): string =>
  [
    'MOOD CALLOUTS (NO ICONS) — Render callout text and optional 4px dot markers only. DO NOT render circular icon illustrations. Line rule: thin 1px straight line; lines must not cross each other. Keep all markers and text outside product edges and skin.',
    'Callouts 1+2 on LEFT side pointing RIGHT into bra. Callouts 3+4 on RIGHT side pointing LEFT into bra. Symmetric layout.',
    formatCalloutEntryNoIcon(
      0,
      callouts[0],
      'LEFT SIDE — upper position',
      `thin 1px ${brand.fontHex} line runs from a 4px dot just outside the product LEFT edge to the callout text; dot/text stay off skin and off garment fabric`,
      brand
    ),
    formatCalloutEntryNoIcon(
      1,
      callouts[1],
      'LEFT SIDE — lower position (min 180px below Callout 1)',
      `thin 1px ${brand.fontHex} line runs from a 4px dot just outside the product LEFT edge to the callout text; dot/text stay off skin and off garment fabric`,
      brand
    ),
    formatCalloutEntryNoIcon(
      2,
      callouts[2],
      'RIGHT SIDE — upper position',
      `thin 1px ${brand.fontHex} line runs from a 4px dot just outside the product RIGHT edge to the callout text; dot/text stay off skin and off garment fabric`,
      brand
    ),
    formatCalloutEntryNoIcon(
      3,
      callouts[3],
      'RIGHT SIDE — lower position (min 180px below Callout 3)',
      `thin 1px ${brand.fontHex} line runs from a 4px dot just outside the product RIGHT edge to the callout text; dot/text stay off skin and off garment fabric`,
      brand
    ),
    buildOverrideFooter(brand),
  ].join('\n\n');

// ========================================
// BRAND DIRECTION BLOCK
// Exported for use in Creative Direction (custom prompt) mode in geminiService.
// ========================================

export const buildBrandDirectionBlock = (brand: BrandSpecification): string =>
  [
    'BRAND SPECIFICATION LOCK (MANDATORY — overrides any earlier brand/font/color/background instruction):',
    `Brand: ${brand.label}`,
    `Headings / Display font: ${brand.headingsDisplay}. Use this for all headline, heading, display, callout feature, and bold line-1 text.`,
    `Sub-heading / Callouts font: ${brand.bodyUi}. Use this for all sub-heading, body, UI, benefit, and regular line-2 text.`,
    `Font hex code: ${brand.fontHex}. Use this exact color for all visible typography, callout lines, dots, icon borders, and icon fills.`,
    `Background color: ${brand.backgroundColor}. Use this exact hex as the full-frame primary background/backdrop color.`,
    `Background hard lock: the visible wall/backdrop/negative space must visually match ${brand.backgroundColor}; do not substitute warm beige, cream, grey, white, taupe, curtains, room decor, or lifestyle interior colors that do not match this exact selected-brand hex.`,
    `Palette notes: ${brand.paletteNotes}`,
    `Overall look and feel: ${brand.overallLookFeel}`,
    `Do not use Tweens defaults unless the selected brand is Tweens. Do not use #F3F0E9, #6F4940, Fraunces, or Inter when this selected brand specifies different values.`,
    `Never render the font names or brand-spec text inside the image; only use them as styling instructions.`,
  ].join('\n');

// ========================================
// CORE PROMPT UTILITIES
// ========================================

const trimNonEmptyParts = (parts: string[]): string[] =>
  parts.map((part) => part.trim()).filter(Boolean);

const splitPromptPair = (
  value: string | undefined,
  fallbackLine1: string,
  fallbackLine2: string,
  useFallbackIfEmpty: boolean = true
): [string, string] => {
  // Strip wrapping quotes that may come from Google Sheets CSV data
  const input = value?.trim().replace(/^["']|["']$/g, '');
  if (!input) return useFallbackIfEmpty ? [fallbackLine1, fallbackLine2] : ['', ''];

  const explicitParts = trimNonEmptyParts(input.split(/\r?\n|\s*\/\s*|\s*\|\s*|\s*[•·]\s*/));
  if (explicitParts.length >= 2) return [explicitParts[0], explicitParts[1]];

  const sentenceParts = trimNonEmptyParts(input.split(/\s*[.!?]\s+/));
  if (sentenceParts.length >= 2) return [sentenceParts[0], sentenceParts[1]];

  const withSplit = input.match(/^(.+?)\s+(with\b.+)$/i);
  if (withSplit) return [withSplit[1].trim(), withSplit[2].trim()];

  const dashParts = trimNonEmptyParts(input.split(/\s+[-–—]\s+/));
  if (dashParts.length >= 2) return [dashParts[0], dashParts[1]];

  const words = input.split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    const splitIndex = words.length === 3 ? 1 : Math.ceil(words.length / 2);
    return [words.slice(0, splitIndex).join(' '), words.slice(splitIndex).join(' ')];
  }
  if (words.length === 2) {
    return [words[0], words[1]];
  }

  // Single word or unrecognized format — use as feature only, no default benefit fallback
  return [input, ''];
};

interface PromptCopy3 {
  heading: string;
  subHead: string;
  callout1: [string, string];
  callout2: [string, string];
  callout3: [string, string];
}

interface PromptCopy4 extends PromptCopy3 {
  callout4: [string, string];
}

const buildPromptCopy3 = (
  content: ImageCalloutsContent | undefined,
  defaults: PromptCopy3
): PromptCopy3 => {
  const isCustom = content !== undefined;
  return {
    heading: isCustom ? (content.heading || '') : defaults.heading,
    subHead: isCustom ? (content.subHead || '') : defaults.subHead,
    callout1: splitPromptPair(content?.callout1, defaults.callout1[0], defaults.callout1[1], !isCustom),
    callout2: splitPromptPair(content?.callout2, defaults.callout2[0], defaults.callout2[1], !isCustom),
    callout3: splitPromptPair(content?.callout3, defaults.callout3[0], defaults.callout3[1], !isCustom),
  };
};

const buildPromptCopy4 = (
  content: ImageCalloutsContent | undefined,
  defaults: PromptCopy4
): PromptCopy4 => ({
  ...buildPromptCopy3(content, defaults),
  callout4: splitPromptPair(content?.callout4, defaults.callout4[0], defaults.callout4[1]),
});

const PROMPT_SOURCE = promptsTxt;
const PUSHUP_PROMPT_SOURCE = pushupPromptsTxt;
const BRA_ONLY_PROMPT_SOURCE = braOnlyPromptsTxt;
const PUSHUP_BRA_ONLY_PROMPT_SOURCE = pushupBraOnlyPromptsTxt;

const extractPromptSection = (
  source: string,
  startMarker: string,
  endMarker?: string
): string => {
  const startIndex = source.indexOf(startMarker);
  if (startIndex === -1) throw new Error(`Missing prompt section: ${startMarker}`);
  const endIndex = endMarker
    ? source.indexOf(endMarker, startIndex + startMarker.length)
    : -1;
  return source
    .slice(startIndex, endIndex === -1 ? source.length : endIndex)
    .trim();
};

const replaceAllSafe = (value: string, search: string, replacement: string): string =>
  value.split(search).join(replacement);

const replaceWordSafe = (value: string, search: string, replacement: string): string =>
  value.replace(new RegExp(`\\b${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), replacement);

const normalizePromptTokens = (prompt: string, brand: BrandSpecification): string => {
  let output = prompt;
  
  // Replace Tweens baseline
  output = replaceWordSafe(output, 'Tweens', brand.label);
  output = replaceAllSafe(output, '#F3F0E9', brand.backgroundColor);
  output = replaceAllSafe(output, '#6F4940', brand.fontHex);
  output = replaceWordSafe(output, 'Fraunces', brand.headingsDisplay);
  output = replaceWordSafe(output, 'Inter', brand.bodyUi);

  // Replace Souminie baseline (the new Bra Prompt.txt baseline)
  output = replaceWordSafe(output, 'Souminie', brand.label);
  output = replaceAllSafe(output, '#F5FBFF', brand.backgroundColor);
  output = replaceAllSafe(output, '#2D4FA0', brand.fontHex);
  output = replaceWordSafe(output, 'Sora', brand.headingsDisplay);
  output = replaceWordSafe(output, 'DM Sans', brand.bodyUi);

  // Replace Invisi-Soft baseline
  output = replaceWordSafe(output, 'Invisi-Soft', brand.label);
  output = replaceAllSafe(output, '#F6F8FB', brand.backgroundColor);
  output = replaceAllSafe(output, '#304C7A', brand.fontHex);
  output = replaceWordSafe(output, 'Playfair Display', brand.headingsDisplay);
  output = replaceWordSafe(output, 'Plus Jakarta Sans', brand.bodyUi);

  output = output.replace(
    /warm creamy beige(?: tones)?(?: aligned with #[A-Fa-f0-9]{6})?/gi,
    `${brand.paletteNotes}`
  );
  output = output.replace(
    /cool airy off-white(?: tones)?(?: aligned with #[A-Fa-f0-9]{6})?/gi,
    `${brand.paletteNotes}`
  );
  output = output.replace(
    /minimal premium daily comfort/gi,
    brand.overallLookFeel
  );
  output = output.replace(
    /invisible comfort luxury/gi,
    brand.overallLookFeel
  );
  output = output.replace(/Palette notes: .*$/gm, `Palette notes: ${brand.paletteNotes}`);
  output = output.replace(
    /Overall look and feel: .*$/gm,
    `Overall look and feel: ${brand.overallLookFeel}`
  );
  output = output.replace(
    /consistent with .*? identity/gi,
    `consistent with ${brand.label}'s "${brand.overallLookFeel}" identity`
  );
  return output;
};

const replaceCopyTokens = (
  prompt: string,
  replacements: Array<[string, string]>
): string =>
  replacements.reduce((acc, [search, replacement]) => replaceAllSafe(acc, search, replacement), prompt);

const sanitizePromptText = (value: string): string =>
  value.replace(/\s+/g, ' ').trim().replace(/"/g, "'");

const replaceQuotedTextToken = (search: string, replacement: string): [string, string] => [
  `"${sanitizePromptText(search)}"`,
  `"${sanitizePromptText(replacement)}"`,
];

const buildMoodTextLock = (copy: PromptCopy4): string => {
  const lines = [
    'TEXT LOCK (MANDATORY)',
    'Render the text exactly as specified below. Do not paraphrase, reword, or invent alternate copy.',
    `Headline: "${sanitizePromptText(copy.heading)}"`,
    `Sub-head: "${sanitizePromptText(copy.subHead)}"`,
  ];
  for (const [i, pair] of [copy.callout1, copy.callout2, copy.callout3, copy.callout4].entries()) {
    lines.push(`Callout ${i + 1} Feature: "${sanitizePromptText(pair[0])}"`);
    if (pair[1]) lines.push(`Callout ${i + 1} Benefit: "${sanitizePromptText(pair[1])}"`);
  }
  return lines.join('\n');
};

const buildTextLock3 = (copy: PromptCopy3): string => {
  const lines = [
    'TEXT LOCK (MANDATORY)',
    'Render the text exactly as specified below. Do not paraphrase, reword, or invent alternate copy.',
    `Headline: "${sanitizePromptText(copy.heading)}"`,
    `Sub-head: "${sanitizePromptText(copy.subHead)}"`,
  ];
  for (const [i, pair] of [copy.callout1, copy.callout2, copy.callout3].entries()) {
    lines.push(`Callout ${i + 1} Feature: "${sanitizePromptText(pair[0])}"`);
    if (pair[1]) lines.push(`Callout ${i + 1} Benefit: "${sanitizePromptText(pair[1])}"`);
  }
  return lines.join('\n');
};

const buildCalloutTextColorLock = (brand: BrandSpecification, callouts?: ResolvedCallout[]): string => {
  const hasBenefits = callouts && callouts.some((c) => c.benefit);
  const lines = [
    'CALLOUT TEXT COLOR LOCK (MANDATORY)',
    `Every callout feature and benefit must be rendered in exact brand text color ${brand.fontHex}.`,
    `Do not render any callout text in black, gray, charcoal, or default dark text.`,
    `Use ${brand.headingsDisplay} bold for callout feature lines.`,
  ];
  if (hasBenefits) {
    lines.push(`Use ${brand.bodyUi} regular for benefit lines.`);
  }
  return lines.join('\n');
};

const buildCalloutPlacementLock = (): string =>
  [
    "CALLOUT PLACEMENT LOCK (CRITICAL & MANDATORY)",
    "ABSOLUTELY NO TEXT, ICONS, OR GRAPHICS MAY OVERLAP THE MODEL'S SKIN, BODY, HAIR, OR GARMENT.",
    "All icon circles, icon artwork, callout text, labels, dots, and decorative callout elements must be placed ONLY on the clean empty background/negative space.",
    "If the model's arm, shoulder, or torso occupies a side of the frame, YOU MUST push the callouts further out into the empty background or reposition the model to ensure ZERO overlap.",
    "Keep callout icons and text at least 32px away from the model silhouette and garment edges.",
    "Pointer lines may approach feature areas, but the visible line must not run across skin or product fabric; use the shortest clean route through background space and stop at the edge.",
  ].join('\n');

const buildCalloutPlacementLockNoIcon = (): string =>
  [
    "CALLOUT PLACEMENT LOCK (MOOD — NO ICONS — CRITICAL)",
    "ABSOLUTELY NO TEXT OR GRAPHICS MAY OVERLAP THE MODEL'S SKIN, BODY, HAIR, OR GARMENT.",
    "All callout text, labels, dots, and decorative callout elements must be placed ONLY on the clean empty background/negative space.",
    "If the model's arm, shoulder, or torso occupies a side of the frame, YOU MUST push the text further out into the empty background or reposition the model to ensure ZERO overlap.",
    "Keep callout text and dots at least 32px away from the model silhouette and garment edges.",
    "Pointer lines may approach feature areas, but the visible line must not run across skin or product fabric; use the shortest clean route through background space and stop at the edge.",
  ].join('\n');

const buildBackgroundColorLock = (brand: BrandSpecification): string =>
  [
    'FINAL BACKGROUND COLOR LOCK (MANDATORY)',
    `Use exact selected-brand background hex ${brand.backgroundColor} as the dominant full-frame background color.`,
    `The entire visible background must read as ${brand.backgroundColor}: backdrop, wall, floor wash, empty negative space, and all soft-focus background areas.`,
    `Use a clean seamless studio backdrop or very minimal flat environment in ${brand.backgroundColor}.`,
    `Do not use Tweens #F3F0E9 unless the selected brand is Tweens.`,
    `Do not use generic warm beige, cream, grey, white, taupe, yellow ivory, brown curtains, bedroom interiors, room corners, windows, decor, or unrelated lifestyle room colors if they shift away from ${brand.backgroundColor}.`,
    `If a lifestyle setting is requested earlier, override it: simplify it into a clean minimal brand-colored environment where the visible background still reads as ${brand.backgroundColor}.`,
    `For ${brand.label}, the background must visually match ${brand.backgroundColor}, not a warmer beige or cream approximation.`,
  ].join('\n');

const buildFinalBrandRenderLock = (brand: BrandSpecification): string =>
  [
    'FINAL BRAND RENDER LOCK (ABSOLUTE)',
    `Selected brand: ${brand.label}`,
    `Background/backdrop hex: ${brand.backgroundColor}. This exact brand background must dominate the image, including Mood Shot.`,
    `Heading/display font: ${brand.headingsDisplay}.`,
    `Sub-heading/callout font: ${brand.bodyUi}.`,
    `All typography, callout lines, and dots use font hex ${brand.fontHex}.`,
    `Do not use any other background hex, font family, or text color for this selected brand.`,
  ].join('\n');

const buildFinalBrandRenderLockNoIcon = (brand: BrandSpecification): string =>
  [
    'FINAL BRAND RENDER LOCK (MOOD — NO ICONS)',
    `Selected brand: ${brand.label}`,
    `Background/backdrop hex: ${brand.backgroundColor}. This exact brand background must dominate the image, including Mood Shot.`,
    `Heading/display font: ${brand.headingsDisplay}.`,
    `Sub-heading/callout font: ${brand.bodyUi}.`,
    `All typography, callout lines, and dots use font hex ${brand.fontHex}.`,
    `Do not use any other background hex, font family, or text color for this selected brand.`,
  ].join('\n');

const buildPromptFromSection = (
  startMarker: string,
  endMarker: string | undefined,
  brand: BrandSpecification | undefined,
  replacements: Array<[string, string]> = [],
  source = PROMPT_SOURCE
): string => {
  const section = extractPromptSection(source, startMarker, endMarker);
  const normalized = brand ? normalizePromptTokens(section, brand) : section;
  const withCopy = replaceCopyTokens(normalized, replacements);
  return brand ? `${withCopy}\n\n${buildBrandDirectionBlock(brand)}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}` : withCopy;
};

// ========================================
// SECTION A: BRA + PANTY MODE PROMPTS
// ========================================

export const getBraPantyFrontViewPrompt = (brand: BrandSpecification): string =>
  buildPromptFromSection('Front View PROMPT', 'FRONT PUSH-UP PROMPT', brand);

export const getBraPantyFrontLifestyleViewPrompt = (brand: BrandSpecification): string =>
  buildPromptFromSection('Front View PROMPT', 'FRONT PUSH-UP PROMPT', brand);

export const getBraPantyFrontPushUpPrompt = (brand: BrandSpecification): string =>
  buildPromptFromSection('FRONT PUSH-UP PROMPT', 'MOOD SHOOT PROMPT', brand);

// SIDE VIEW 1 — defaults match the actual text in the SIDE VIEW PROMPT section of Prompts.txt
export const getBraPantySideViewPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'Elastic-Free Construction',
    subHead: 'No Digging. No Marks. No Itching.',
    callout1: ['Elastic-free Armhole', 'for Rashfree Comfort'],
    callout2: ['Elastic-free Bottom Band', 'for Seamless Support'],
    callout3: ['Seamless Design,', 'Invisible under Outfits'],
  });

  const basePrompt = replaceCopyTokens(
    buildPromptFromSection('SIDE VIEW PROMPT', 'SIDE VIEW 2 PROMPT', brand),
    [
      replaceQuotedTextToken('Elastic-Free Construction', copy.heading),
      replaceQuotedTextToken('No Digging. No Marks. No Itching.', copy.subHead),
      replaceQuotedTextToken('Elastic-free Armhole', copy.callout1[0]),
      replaceQuotedTextToken('for Rashfree Comfort', copy.callout1[1]),
      replaceQuotedTextToken('Elastic-free Bottom Band', copy.callout2[0]),
      replaceQuotedTextToken('for Seamless Support', copy.callout2[1]),
      replaceQuotedTextToken('Seamless Design,', copy.callout3[0]),
      replaceQuotedTextToken('Invisible under Outfits', copy.callout3[1]),
    ]
  );

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  return `${basePrompt}\n\n${buildSideView1Override(callouts, brand)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

// SIDE VIEW 2 — defaults match the actual text in the SIDE VIEW 2 PROMPT section of Prompts.txt
export const getBraPantySideView2Prompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'Comfort that feels light',
    subHead: 'Soft touch. Gentle support.',
    callout1: ['Breathable Cotton Fabric', 'for airy comfort all day'],
    callout2: ['Light Padding gives', 'Gentle Lift'],
    callout3: ['Hidden Internal Gripper', 'for Perfect Fit'],
  });

  const basePrompt = replaceCopyTokens(
    buildPromptFromSection('SIDE VIEW 2 PROMPT', 'BACK VIEW PROMPT', brand),
    [
      replaceQuotedTextToken('Comfort that feels light', copy.heading),
      replaceQuotedTextToken('Soft touch. Gentle support.', copy.subHead),
      replaceQuotedTextToken('Breathable Cotton Fabric', copy.callout1[0]),
      replaceQuotedTextToken('for airy comfort all day', copy.callout1[1]),
      replaceQuotedTextToken('Light Padding gives', copy.callout2[0]),
      replaceQuotedTextToken('Gentle Lift', copy.callout2[1]),
      replaceQuotedTextToken('Hidden Internal Gripper', copy.callout3[0]),
      replaceQuotedTextToken('for Perfect Fit', copy.callout3[1]),
    ]
  );

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  return `${basePrompt}\n\n${buildSideView2Override(callouts, brand)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

// BACK VIEW
export const getBraPantyBackViewPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'All Day Sturdy Back Support',
    subHead: 'Curve-Secure Fit. Stays Put. Always.',
    callout1: ['U-Back Support', 'No Ride-Up'],
    callout2: ['3-Level Adjustable', 'Hook Closure'],
    callout3: ['Wide Side Wings', 'for Back Smoothening'],
  });

  const basePrompt = replaceCopyTokens(
    buildPromptFromSection('BACK VIEW PROMPT', 'Front View PROMPT', brand),
    [
      replaceQuotedTextToken('All Day Sturdy Back Support', copy.heading),
      replaceQuotedTextToken('Curve-Secure Fit. Stays Put. Always.', copy.subHead),
      replaceQuotedTextToken('U-Back Support', copy.callout1[0]),
      replaceQuotedTextToken('No Ride-Up', copy.callout1[1]),
      replaceQuotedTextToken('3-Level Adjustable', copy.callout2[0]),
      replaceQuotedTextToken('Hook Closure', copy.callout2[1]),
      replaceQuotedTextToken('Wide Side Wings', copy.callout3[0]),
      replaceQuotedTextToken('for Back Smoothening', copy.callout3[1]),
    ]
  );

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  return `${basePrompt}\n\n${buildBackViewOverride(callouts, brand)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

// MOOD VIEW
export const getBraPantyMoodViewPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy4(content, {
    heading: 'Bonded Finish, Elevated Support',
    subHead: 'Comfort That Supports Every Curve',
    callout1: ['Full Coverage', 'with V-Neckline'],
    callout2: ['W-Hold', 'Wire-free Support'],
    callout3: ['Broad Shoulder', 'Straps'],
    callout4: ['No Spillage', 'No Side Bulges'],
  });

  const basePrompt = replaceCopyTokens(
    buildPromptFromSection('MOOD SHOOT PROMPT', 'BRA PANTY ZOOM PROMPT', brand),
    [
      replaceQuotedTextToken('Bonded Finish, Elevated Support', copy.heading),
      replaceQuotedTextToken('Comfort That Supports Every Curve', copy.subHead),
      replaceQuotedTextToken('Full Coverage', copy.callout1[0]),
      replaceQuotedTextToken('with V-Neckline', copy.callout1[1]),
      replaceQuotedTextToken('W-Hold', copy.callout2[0]),
      replaceQuotedTextToken('Wire-free Support', copy.callout2[1]),
      replaceQuotedTextToken('Broad Shoulder', copy.callout3[0]),
      replaceQuotedTextToken('Straps', copy.callout3[1]),
      replaceQuotedTextToken('No Spillage', copy.callout4[0]),
      replaceQuotedTextToken('No Side Bulges', copy.callout4[1]),
    ]
  );

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
    resolveCallout(copy.callout4, content?.zone4),
  ];

  return `${basePrompt}\n\n${buildMoodViewOverride(callouts, brand)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLockNoIcon()}\n\n${buildMoodTextLock(copy)}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLockNoIcon(brand)}`;
};

// ZOOM VIEW (close-up bra on model, split-panel layout)
export const getBraPantyZoomPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'Elastic-Free Construction',
    subHead: '',
    callout1: ['Elastic-free Armhole', 'for Rashfree Comfort'],
    callout2: ['Elastic-free Bottom Band', 'for Seamless Support'],
    callout3: ['Seamless Design,', 'Invisible under Outfits'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  const basePrompt = buildPromptFromSection('BRA PANTY ZOOM PROMPT', 'BRA PANTY MOCKUP PROMPT', brand);

  return `${basePrompt}\n\n${buildTextLock3(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

// MOCKUP VIEW (floating product only, bra image only)
export const getBraPantyMockupPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy4(content, {
    heading: 'Effortless Lift, Everyday Comfort',
    subHead: '',
    callout1: ['3/4th Coverage', ''],
    callout2: ['Soft Level 2 Padding', ''],
    callout3: ['Adjustable Straps', ''],
    callout4: ['Wide Side Wings', ''],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
    resolveCallout(copy.callout4, content?.zone4),
  ];

  return `${buildPromptFromSection('BRA PANTY MOCKUP PROMPT', 'PANTY ONLY FRONT VIEW PROMPT', brand)}\n\n${buildMoodTextLock(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLockNoIcon()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLockNoIcon(brand)}`;
};

// ========================================
// SECTION A2: PUSHUP MODE PROMPTS
// ========================================

const buildPushupPromptFromSection = (
  startMarker: string,
  endMarker: string | undefined,
  brand: BrandSpecification,
  replacements: Array<[string, string]> = []
): string =>
  buildPromptFromSection(startMarker, endMarker, brand, replacements, PUSHUP_PROMPT_SOURCE);

const buildPushupBraOnlyPromptFromSection = (
  startMarker: string,
  endMarker: string | undefined,
  brand: BrandSpecification,
  replacements: Array<[string, string]> = []
): string =>
  buildPromptFromSection(startMarker, endMarker, brand, replacements, PUSHUP_BRA_ONLY_PROMPT_SOURCE);

export const getPushupBraOnlyFrontPrompt = (brand: BrandSpecification): string =>
  buildPushupBraOnlyPromptFromSection('FRONT PUSH UP PROMPT — BRA ONLY', 'SIDE 1 PUSH UP PROMPT — BRA ONLY', brand);

export const getPushupBraOnlySide1Prompt = (
  brand: BrandSpecification,
  _content?: ImageCalloutsContent
): string =>
  buildPushupBraOnlyPromptFromSection(
    'SIDE 1 PUSH UP PROMPT — BRA ONLY',
    'SIDE 2 PUSH UP PROMPT — BRA ONLY',
    brand
  );

export const getPushupBraOnlySide2Prompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'Comfort that feels light',
    subHead: 'Soft touch. Gentle support.',
    callout1: ['Breathable Cotton Fabric', 'for airy comfort all day'],
    callout2: ['Light Padding gives', 'Gentle Lift'],
    callout3: ['Hidden Internal Gripper', 'for Perfect Fit'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  const basePrompt = buildPushupBraOnlyPromptFromSection(
    'SIDE 2 PUSH UP PROMPT — BRA ONLY',
    'BACK PUSH UP PROMPT — BRA ONLY',
    brand,
    [
      ['"Comfort that feels light"', `"${copy.heading}"`],
      ['"Soft touch. Gentle support."', `"${copy.subHead}"`],
      ['"Breathable Cotton Fabric "', `"${copy.callout1[0]}"`],
      ['"for airy comfort all day"', `"${copy.callout1[1]}"`],
      ['"Light Padding gives"', `"${copy.callout2[0]}"`],
      ['"Gentle Lift"', `"${copy.callout2[1]}"`],
      ['"Hidden Internal Gripper"', `"${copy.callout3[0]}"`],
      ['"for Perfect Fit"', `"${copy.callout3[1]}"`],
    ]
  );

  return `${basePrompt}\n\n${buildTextLock3(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

export const getPushupBraOnlyBackPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'All Day Sturdy Back Support',
    subHead: 'Curve-Secure Fit. Stays Put. Always.',
    callout1: ['U-Back Support', 'No Ride-Up'],
    callout2: ['3-Level Adjustable', 'Hook Closure'],
    callout3: ['Wide Side Wings', 'for Back Smoothening'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  const basePrompt = buildPushupBraOnlyPromptFromSection('BACK PUSH UP PROMPT — BRA ONLY', 'MOOD PUSH UP PROMPT — BRA ONLY', brand);

  return `${basePrompt}\n\n${buildTextLock3(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

export const getPushupBraOnlyMoodPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy4(content, {
    heading: 'Bonded Finish, Elevated Support',
    subHead: 'Comfort That Supports Every Curve',
    callout1: ['Full Coverage', 'with V-Neckline'],
    callout2: ['W-Hold', 'Wire-free Support'],
    callout3: ['Broad Shoulder', 'Straps'],
    callout4: ['No Spillage', 'No Side Bulges'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
    resolveCallout(copy.callout4, content?.zone4),
  ];

  const basePrompt = buildPushupBraOnlyPromptFromSection('MOOD PUSH UP PROMPT — BRA ONLY', 'ZOOM PUSH UP PROMPT — (UNCHANGED — BRA ONLY BY DEFAULT)', brand);

  return `${basePrompt}\n\n${buildMoodTextLock(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLockNoIcon()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLockNoIcon(brand)}`;
};

export const getPushupBraOnlyZoomPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'Elastic-Free Construction',
    subHead: '',
    callout1: ['Elastic-free Armhole', 'for Rashfree Comfort'],
    callout2: ['Elastic-free Bottom Band', 'for Seamless Support'],
    callout3: ['Seamless Design,', 'Invisible under Outfits'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  const basePrompt = buildPushupBraOnlyPromptFromSection('ZOOM PUSH UP PROMPT — (UNCHANGED — BRA ONLY BY DEFAULT)', 'MOCKUP PROMPT — (UNCHANGED — PRODUCT ONLY BY DEFAULT)', brand);

  return `${basePrompt}\n\n${buildTextLock3(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

export const getPushupBraOnlyMockupPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy4(content, {
    heading: 'Effortless Lift, Everyday Comfort',
    subHead: '',
    callout1: ['3/4th Coverage', ''],
    callout2: ['Soft Level 2 Padding', ''],
    callout3: ['Adjustable Straps', ''],
    callout4: ['Wide Side Wings', ''],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
    resolveCallout(copy.callout4, content?.zone4),
  ];

  return `${buildPushupBraOnlyPromptFromSection('MOCKUP PROMPT — (UNCHANGED — PRODUCT ONLY BY DEFAULT)', undefined, brand)}\n\n${buildMoodTextLock(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLockNoIcon()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLockNoIcon(brand)}`;
};

export const getPushupFrontPrompt = (brand: BrandSpecification): string =>
  `${buildPushupPromptFromSection('FRONT PUSH UP PROMPT', 'SIDE 1 PUSH UP PROMPT', brand)}

FINAL FRONT PUSHUP FRAMING LOCK (MANDATORY):
The final image must include the complete panty product from Image 3. Show the panty from waistband through leg openings with front coverage, side edges, fabric texture, and exact design visible. The crop may end at upper thigh, below the panty leg openings, but must never end at the waistband.
Do not generate a bra-only crop. Do not crop through the panty. Do not show only the panty waistband. If any earlier instruction suggests head-to-waist framing or cropping at the panty waistband, ignore it and follow this full-panty visibility lock.
Panty product visibility is mandatory and equal in importance to bra visibility.

${buildBackgroundColorLock(brand)}

${buildFinalBrandRenderLock(brand)}

FINAL FRONT PUSHUP NO-TEXT LOCK (ABSOLUTE):
Render a clean product photograph only. Do not render any visible text, brand names, logos, headlines, font names, labels, callouts, arrows, pointer lines, icons, dots, badges, watermarks, captions, decorative UI marks, or typography anywhere in the image.
Do not render "${brand.label}", "${brand.headingsDisplay}", "${brand.bodyUi}", "Push Up", "Level 3", or any invented product copy. Use brand specifications only as hidden styling guidance for background mood/color, never as visible content.
The final image must contain only the model, bra, panty, skin/hair, and clean background.`;

export const getPushupSide1Prompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'Elastic-Free Construction',
    subHead: 'No Digging. No Marks. No Itching.',
    callout1: ['Elastic-free Armhole', 'for Rashfree Comfort'],
    callout2: ['Elastic-free Bottom Band', 'for Seamless Support'],
    callout3: ['Seamless Design', 'Invisible under Outfits'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  return `${buildPushupPromptFromSection('SIDE 1 PUSH UP PROMPT', 'SIDE 2 PUSH UP PROMPT', brand)}\n\n${buildTextLock3(copy)}\n\n${buildSideView1Override(callouts, brand)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

export const getPushupSide2Prompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'Comfort that feels light',
    subHead: 'Soft touch. Gentle support.',
    callout1: ['Breathable Cotton Fabric', 'for airy comfort all day'],
    callout2: ['Level 3 Padding gives', 'Visible Lift'],
    callout3: ['Hidden Internal Gripper', 'for Perfect Fit'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  return `${buildPushupPromptFromSection('SIDE 2 PUSH UP PROMPT', 'BACK PUSH UP PROMPT', brand)}\n\n${buildTextLock3(copy)}\n\n${buildSideView2Override(callouts, brand)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

export const getPushupBackPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'All Day Sturdy Back Support',
    subHead: 'Curve-Secure Fit. Stays Put. Always.',
    callout1: ['U-Back Support', 'No Ride-Up'],
    callout2: ['3-Level Adjustable', 'Hook Closure'],
    callout3: ['Wide Side Wings', 'for Back Smoothening'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  return `${buildPushupPromptFromSection('BACK PUSH UP PROMPT', 'MOOD PUSH UP PROMPT', brand)}\n\n${buildTextLock3(copy)}\n\n${buildBackViewOverride(callouts, brand)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

export const getPushupMoodPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy4(content, {
    heading: 'Shape, Lift & Comfort',
    subHead: 'Shape, Lift & Comfort for Every Curve',
    callout1: ['3/4th Coverage', 'Cups'],
    callout2: ['W-Hold Support', ''],
    callout3: ['Sweetheart Neckline', 'Defined Curves'],
    callout4: ['Wire-Free Design', ''],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
    resolveCallout(copy.callout4, content?.zone4),
  ];

  return `${buildPushupPromptFromSection('MOOD PUSH UP PROMPT', 'ZOOM PUSH UP PROMPT', brand)}\n\n${buildMoodViewOverride(callouts, brand)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLockNoIcon()}\n\n${buildMoodTextLock(copy)}\n\nMOOD POSE FINAL ICON RULE: Do not render icons, icon circles, icon illustrations, or icon containers. Mood pose uses text, thin lines, and optional 4px dots only.\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLockNoIcon(brand)}`;
};

export const getPushupZoomPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'Bonded Pushup Bra',
    subHead: '',
    callout1: ['Invisible', 'under outfits'],
    callout2: ['Sits smooth', 'on skin'],
    callout3: ['No Digging.', 'No Rashes.'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  return `${buildPushupPromptFromSection('ZOOM PUSH UP PROMPT', 'MOCKUP PROMPT', brand)}\n\nTEXT LOCK (MANDATORY)\nHeadline: "${sanitizePromptText(copy.heading)}"\nCallout 1: "${sanitizePromptText(copy.callout1.join(' '))}"\nCallout 2: "${sanitizePromptText(copy.callout2.join(' '))}"\nCallout 3: "${sanitizePromptText(copy.callout3.join(' '))}"\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLockNoIcon()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLockNoIcon(brand)}`;
};

export const getPushupMockupPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy4(content, {
    heading: 'Effortless Lift, Everyday Comfort',
    subHead: '',
    callout1: ['3/4th Coverage', ''],
    callout2: ['Soft Level 2 Padding', ''],
    callout3: ['Adjustable Straps', ''],
    callout4: ['Wide Side Wings', ''],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
    resolveCallout(copy.callout4, content?.zone4),
  ];

  return `${buildPushupPromptFromSection('MOCKUP PROMPT', undefined, brand)}\n\n${buildMoodTextLock(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLockNoIcon()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLockNoIcon(brand)}`;
};

// ========================================
// SECTION A3: BRA ONLY MODE PROMPTS
// ========================================

const buildBraOnlyPromptFromSection = (
  startMarker: string,
  endMarker: string | undefined,
  brand: BrandSpecification,
  replacements: Array<[string, string]> = []
): string =>
  buildPromptFromSection(startMarker, endMarker, brand, replacements, BRA_ONLY_PROMPT_SOURCE);

export const getBraOnlyFrontPrompt = (brand: BrandSpecification): string =>
  buildBraOnlyPromptFromSection('BRA ONLY FRONT PROMPT', 'BRA ONLY SIDE 1 PROMPT', brand);

export const getBraOnlySide1Prompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'Elastic-Free Construction',
    subHead: 'No Digging. No Marks. No Itching.',
    callout1: ['Elastic-free Armhole', 'for Rashfree Comfort'],
    callout2: ['Elastic-free Bottom Band', 'for Seamless Support'],
    callout3: ['Seamless Design,', 'Invisible under Outfits'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  const basePrompt = buildBraOnlyPromptFromSection('BRA ONLY SIDE 1 PROMPT', 'BRA ONLY SIDE 2 PROMPT', brand);

  return `${basePrompt}\n\n${buildTextLock3(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

export const getBraOnlySide2Prompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'Comfort that feels light',
    subHead: 'Soft touch. Gentle support.',
    callout1: ['Breathable Cotton Fabric', 'for airy comfort all day'],
    callout2: ['Light Padding gives', 'Gentle Lift'],
    callout3: ['Hidden Internal Gripper', 'for Perfect Fit'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  const basePrompt = buildBraOnlyPromptFromSection('BRA ONLY SIDE 2 PROMPT', 'BRA ONLY BACK PROMPT', brand);

  return `${basePrompt}\n\n${buildTextLock3(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

export const getBraOnlyBackPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'All Day Sturdy Back Support',
    subHead: 'Curve-Secure Fit. Stays Put. Always.',
    callout1: ['U-Back Support', 'No Ride-Up'],
    callout2: ['3-Level Adjustable', 'Hook Closure'],
    callout3: ['Wide Side Wings', 'for Back Smoothening'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  const basePrompt = buildBraOnlyPromptFromSection('BRA ONLY BACK PROMPT', 'BRA ONLY MOOD PROMPT', brand);

  return `${basePrompt}\n\n${buildTextLock3(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

export const getBraOnlyMoodPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy4(content, {
    heading: 'Bonded Finish, Elevated Support',
    subHead: 'Comfort That Supports Every Curve',
    callout1: ['Full Coverage', 'with V-Neckline'],
    callout2: ['W-Hold', 'Wire-free Support'],
    callout3: ['Broad Shoulder', 'Straps'],
    callout4: ['No Spillage', 'No Side Bulges'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
    resolveCallout(copy.callout4, content?.zone4),
  ];

  const basePrompt = buildBraOnlyPromptFromSection('BRA ONLY MOOD PROMPT', 'BRA ONLY ZOOM PROMPT', brand);

  return `${basePrompt}\n\n${buildMoodTextLock(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLockNoIcon()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLockNoIcon(brand)}`;
};

export const getBraOnlyZoomPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy3(content, {
    heading: 'Elastic-Free Construction',
    subHead: '',
    callout1: ['Elastic-free Armhole', 'for Rashfree Comfort'],
    callout2: ['Elastic-free Bottom Band', 'for Seamless Support'],
    callout3: ['Seamless Design,', 'Invisible under Outfits'],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
  ];

  const basePrompt = buildBraOnlyPromptFromSection('BRA ONLY ZOOM PROMPT', 'BRA ONLY MOCKUP PROMPT', brand);

  return `${basePrompt}\n\n${buildTextLock3(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLock()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLock(brand)}`;
};

export const getBraOnlyMockupPrompt = (
  brand: BrandSpecification,
  content?: ImageCalloutsContent
): string => {
  const copy = buildPromptCopy4(content, {
    heading: 'Effortless Lift, Everyday Comfort',
    subHead: '',
    callout1: ['3/4th Coverage', ''],
    callout2: ['Soft Level 2 Padding', ''],
    callout3: ['Adjustable Straps', ''],
    callout4: ['Wide Side Wings', ''],
  });

  const callouts: [ResolvedCallout, ResolvedCallout, ResolvedCallout, ResolvedCallout] = [
    resolveCallout(copy.callout1, content?.zone1),
    resolveCallout(copy.callout2, content?.zone2),
    resolveCallout(copy.callout3, content?.zone3),
    resolveCallout(copy.callout4, content?.zone4),
  ];

  return `${buildBraOnlyPromptFromSection('BRA ONLY MOCKUP PROMPT', undefined, brand)}\n\n${buildMoodTextLock(copy)}\n\n${buildCalloutTextColorLock(brand, callouts)}\n\n${buildCalloutPlacementLockNoIcon()}\n\n${buildBackgroundColorLock(brand)}\n\n${buildFinalBrandRenderLockNoIcon(brand)}`;
};

// ========================================
// SECTION B: PANTY ONLY MODE PROMPTS
// ========================================

export const getPantyOnlyFrontViewPrompt = (backgroundAndLighting: string): string =>
  buildPromptFromSection('PANTY ONLY FRONT VIEW PROMPT', 'PANTY ONLY BACK VIEW PROMPT', undefined, [
    ['{{BACKGROUND_AND_LIGHTING}}', backgroundAndLighting],
  ]);

export const getPantyOnlyBackViewPrompt = (backgroundAndLighting: string): string =>
  buildPromptFromSection('PANTY ONLY BACK VIEW PROMPT', 'PANTY ONLY SIDE VIEW PROMPT', undefined, [
    ['{{BACKGROUND_AND_LIGHTING}}', backgroundAndLighting],
  ]);

export const getPantyOnlySideViewPrompt = (backgroundAndLighting: string): string =>
  buildPromptFromSection('PANTY ONLY SIDE VIEW PROMPT', 'PANTY ONLY MOOD VIEW PROMPT', undefined, [
    ['{{BACKGROUND_AND_LIGHTING}}', backgroundAndLighting],
  ]);

export const getPantyOnlyMoodViewPrompt = (backgroundAndLighting: string): string =>
  buildPromptFromSection('PANTY ONLY MOOD VIEW PROMPT', undefined, undefined, [
    ['{{BACKGROUND_AND_LIGHTING}}', backgroundAndLighting],
  ]);
