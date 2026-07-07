import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import { AspectRatio, FrontViewVariant, ShootMode, SideViewVariant, ViewAngle } from "../types";
import type { ImageCalloutsContent } from "../types";
import {
  buildBrandDirectionBlock,
  getBraPantyBackViewPrompt,
  getBraPantyFrontPushUpPrompt,
  getBraPantyFrontLifestyleViewPrompt,
  getBraPantyFrontViewPrompt,
  getBraPantyMoodViewPrompt,
  getBraPantyZoomPrompt,
  getBraPantyMockupPrompt,
  getBraPantySideViewPrompt,
  getBraPantySideView2Prompt,
  getPantyOnlyBackViewPrompt,
  getPantyOnlyFrontViewPrompt,
  getPantyOnlyMoodViewPrompt,
  getPantyOnlySideViewPrompt,
  getPushupBackPrompt,
  getPushupFrontPrompt,
  getPushupMockupPrompt,
  getPushupMoodPrompt,
  getPushupSide1Prompt,
  getPushupSide2Prompt,
  getPushupZoomPrompt,
  getPushupBraOnlyBackPrompt,
  getPushupBraOnlyFrontPrompt,
  getPushupBraOnlyMockupPrompt,
  getPushupBraOnlyMoodPrompt,
  getPushupBraOnlySide1Prompt,
  getPushupBraOnlySide2Prompt,
  getPushupBraOnlyZoomPrompt,
  getBraOnlyFrontPrompt,
  getBraOnlySide1Prompt,
  getBraOnlySide2Prompt,
  getBraOnlyBackPrompt,
  getBraOnlyMoodPrompt,
  getBraOnlyZoomPrompt,
  getBraOnlyMockupPrompt,
} from "./prompt";
import {
  getBrandSpecification,
  PANTY_ONLY_NEUTRAL_DIRECTION,
} from "./brandSpecifications";
import type { BrandSpecification } from "./brandSpecifications";

interface GenerateShootParams {
  modelBase64: string;
  pantyBase64?: string | null;
  braBase64?: string | null;
  userPrompt: string;
  imageCalloutsContent?: ImageCalloutsContent | null;
  aspectRatio?: AspectRatio;
  viewAngle?: ViewAngle;
  sideViewVariant?: SideViewVariant;
  frontViewVariant?: FrontViewVariant;
  shootMode?: ShootMode;
  pushupBraOnly?: boolean;
  brand?: string;
  aiModel?: string;
}

interface ParsedImage {
  mimeType: string;
  data: string;
}

const FRESH_START_HEADER =
  "FRESH GENERATION — treat this as a completely independent, standalone image request. Do not carry over any visual style, content, or layout from previous outputs.";

const COLOR_LOCK_PREAMBLE =
  "⚠️ CRITICAL COLOR LOCK: Bra and panty MUST be the SAME color/shade. Reference Image 2 (Bra Product) and Reference Image 3 (Panty Product) must match in color EXACTLY. If they appear different in the uploads, harmonize them to the bra's color. This is absolutely non-negotiable — the final image MUST show matching bra and panty colors.";

const BRA_ONLY_FRAME_INSTRUCTION =
  "⚠️ MANDATORY FRAME CROP — BRA ONLY MODE (ABSOLUTE RULE):\n" +
  "Show the model from TOP OF HEAD to NAVEL ONLY. The bottom edge of the frame cuts at navel / waistband level. " +
  "NOTHING below the navel may appear — no legs, no thighs, no panty, no briefs, no lower garment of any kind. " +
  "The model wears only the bra product. Do NOT add or render any lower garment.";

const PUSHUP_BRA_ONLY_FRAME_INSTRUCTION =
  "⚠️ MANDATORY FRAME CROP — PUSHUP BRA ONLY MODE (ABSOLUTE FINAL RULE):\n" +
  "Show the adult model from TOP OF HEAD to NAVEL ONLY. The bottom edge of the image must stop at the natural navel/waistline. " +
  "Only the full push-up bra and a small clean section of natural midriff above the navel may be visible. " +
  "Do NOT show or invent any panty, brief, underwear bottom, boxer shorts, sleep shorts, waistband, hips, pelvis, thighs, legs, or lower body. " +
  "Do NOT widen, spread, exaggerate, or make the waist/hips more curvy. Preserve the model's natural torso proportions and keep the crop tight at the navel. " +
  "If any other instruction mentions mid-thigh framing, lower outfit, matching set, boxer shorts, sleep shorts, panty, hips, thighs, or below-waist content, ignore it completely.";

const buildPushupBraOnlyBrandFrameInstruction = (brand: BrandSpecification): string =>
  [
    "PUSHUP BRA ONLY BRAND BACKGROUND + FRAME LOCK (ABSOLUTE FINAL RULE):",
    `Use the selected brand background color ${brand.backgroundColor} as the dominant full-frame backdrop color.`,
    `The visible background must read as ${brand.label}'s brand backdrop: ${brand.paletteNotes}`,
    `Use a clean seamless studio backdrop or very minimal flat environment in ${brand.backgroundColor}.`,
    `Do NOT render aqua curtains, teal panels, blue drapes, room decor, windows, props, generic white/gray walls, or any background element that shifts away from ${brand.backgroundColor}.`,
    "RIGHT ARM VISIBILITY TEST: the model's right arm on the viewer's right side must be completely visible from shoulder/upper arm down to the navel crop line, including the full outer contour of the arm. A visible strip of clean background must appear outside the entire right arm edge.",
    "If the right arm touches the image edge, is clipped, disappears outside frame, or has no background margin beside it, the image is invalid. Correct it by zooming out and shifting the model left/center before rendering.",
    "Keep the model fully inside the frame. The full head, hair outline, both shoulders, both upper arms, both outer arm contours, full bra, side body edges, and navel crop line must remain visible with safe margins.",
    "Do NOT crop or cut off the right arm, left arm, shoulders, hair, bra band, side body, or navel crop line. Do not place the model flush against the right image edge.",
    "For infographic layouts, keep text/callouts in the left column and fit the model inside the remaining right area without cropping. Reduce model scale if needed; never enlarge the model until the right arm is cut.",
    "Keep at least 8% image-width clear margin between the right arm and the right image edge. Keep at least 4% image-width clear margin between the left body/arm edge and the callout area.",
    "Leave enough negative space for callouts without pushing the model into the image edge. Never crop the model to make room for text or icons.",
  ].join("\n");

const buildPushupBraOnlyCanvasInstruction = (
  viewAngle: ViewAngle,
  sideViewVariant: SideViewVariant
): string => {
  if (viewAngle === "Side" && sideViewVariant === "SIDE_VIEW_2") {
    return [
      "SIDE 2 CANVAS GEOMETRY LOCK — FINAL, EXACT, NON-NEGOTIABLE:",
      "Use a two-zone layout: LEFT TEXT/CALLOUT COLUMN and RIGHT MODEL ZONE.",
      "LEFT TEXT/CALLOUT COLUMN: all headline, subhead, icons, and feature text must stay inside x=4% to x=35%.",
      "RIGHT MODEL ZONE: the entire visible model silhouette must stay inside x=43% to x=86%. No skin, hair, shoulder, bra, side body, or arm may extend beyond x=86%.",
      "RIGHT SAFETY GUTTER: x=86% to x=100% must remain clean empty brand-colored background from top to bottom.",
      "The viewer-right arm's full outer contour must be visible with empty background to its right; it must never touch x=86% or the canvas edge.",
      "Scale the model smaller and shift her left if needed. The model must not be a close-up crop. Do not enlarge the model beyond the right model zone.",
      "If any text, icon, or callout would need more room, shrink or tighten the callout column instead of cropping the model.",
    ].join("\n");
  }

  return [
    "CANVAS GEOMETRY LOCK — FINAL, EXACT, NON-NEGOTIABLE:",
    "The entire visible model silhouette must stay fully inside the canvas with clean brand-colored background visible outside both arms.",
    "Keep a blank right safety gutter outside the viewer-right arm. If the arm approaches the image edge, scale the model down and shift left/center.",
  ].join("\n");
};

const SKIN_QUALITY_INSTRUCTION =
  "SKIN TONE & LIGHTING CONSISTENCY (MANDATORY — applies to the entire body):\n" +
  "The model's skin must appear perfectly even, bright, and uniformly lit from head to toe — face, neck, shoulders, arms, chest, abdomen, legs, and thighs must all share the same warm skin tone and brightness level. " +
  "The legs and thighs must be just as bright, warm, and natural-looking as the face and upper body. " +
  "Do NOT allow any darkening, shadowing, tonal drop-off, desaturation, or colour shift on the legs, knees, or lower body. " +
  "Studio lighting must wrap evenly across the full body length. " +
  "No part of the body should appear dull, grey, cool-toned, or underexposed compared to any other part. " +
  "Replicate the exact skin tone from the model reference image uniformly across every visible skin area.";

const parseBase64Image = (base64: string): ParsedImage => {
  const data = base64.split(",")[1];
  const mimeType = base64.substring(base64.indexOf(":") + 1, base64.indexOf(";"));
  if (!data || !mimeType) {
    throw new Error("Invalid image format. Please upload JPG/PNG files and try again.");
  }
  return { mimeType, data };
};

// Pass zone fields alongside their callout text so prompt builders can use them.
const sanitizeImageCalloutsForPrompt = (
  mode: ShootMode,
  viewAngle: ViewAngle,
  content?: ImageCalloutsContent | null
): ImageCalloutsContent | undefined => {
  if (!content || (mode !== "BRA_AND_PANTY" && mode !== "PUSHUP" && mode !== "BRA_ONLY")) return undefined;

  const base: ImageCalloutsContent = {};

  if (viewAngle === "Mood" || viewAngle === "Mockup") {
    if (content.heading?.trim()) base.heading = content.heading;
    if (content.subHead?.trim()) base.subHead = content.subHead;
    if (content.callout1?.trim()) { base.callout1 = content.callout1; base.zone1 = content.zone1; }
    if (content.callout2?.trim()) { base.callout2 = content.callout2; base.zone2 = content.zone2; }
    if (content.callout3?.trim()) { base.callout3 = content.callout3; base.zone3 = content.zone3; }
    if (content.callout4?.trim()) { base.callout4 = content.callout4; base.zone4 = content.zone4; }
    return base;
  }

  if (viewAngle === "Back" || viewAngle === "Side" || viewAngle === "Zoom") {
    if (content.heading?.trim()) base.heading = content.heading;
    if (content.subHead?.trim()) base.subHead = content.subHead;
    if (content.callout1?.trim()) { base.callout1 = content.callout1; base.zone1 = content.zone1; }
    if (content.callout2?.trim()) { base.callout2 = content.callout2; base.zone2 = content.zone2; }
    if (content.callout3?.trim()) { base.callout3 = content.callout3; base.zone3 = content.zone3; }
    return base;
  }

  if (viewAngle === "Front") return undefined;

  return base;
};

const getPromptByModeAndAngle = (
  mode: ShootMode,
  viewAngle: ViewAngle,
  brandSpec: BrandSpecification,
  sideViewVariant: SideViewVariant,
  frontViewVariant: FrontViewVariant,
  imageCalloutsContent?: ImageCalloutsContent | null,
  pushupBraOnly = false
): string => {
  if (mode === "BRA_AND_PANTY") {
    if (viewAngle === "Back") return getBraPantyBackViewPrompt(brandSpec, imageCalloutsContent ?? undefined);
    if (viewAngle === "Front") {
      return frontViewVariant === "FRONT_PUSH_UP"
        ? getBraPantyFrontPushUpPrompt(brandSpec)
        : getBraPantyFrontLifestyleViewPrompt(brandSpec);
    }
    if (viewAngle === "Side") {
      return sideViewVariant === "SIDE_VIEW_2"
        ? getBraPantySideView2Prompt(brandSpec, imageCalloutsContent ?? undefined)
        : getBraPantySideViewPrompt(brandSpec, imageCalloutsContent ?? undefined);
    }
    if (viewAngle === "Mood") return getBraPantyMoodViewPrompt(brandSpec, imageCalloutsContent ?? undefined);
    if (viewAngle === "Zoom") return getBraPantyZoomPrompt(brandSpec, imageCalloutsContent ?? undefined);
    if (viewAngle === "Mockup") return getBraPantyMockupPrompt(brandSpec, imageCalloutsContent ?? undefined);
    return getBraPantyFrontLifestyleViewPrompt(brandSpec);
  }

  if (mode === "PUSHUP") {
    if (pushupBraOnly) {
      if (viewAngle === "Back") return getPushupBraOnlyBackPrompt(brandSpec, imageCalloutsContent ?? undefined);
      if (viewAngle === "Front") return getPushupBraOnlyFrontPrompt(brandSpec);
      if (viewAngle === "Mood") return getPushupBraOnlyMoodPrompt(brandSpec, imageCalloutsContent ?? undefined);
      if (viewAngle === "Zoom") return getPushupBraOnlyZoomPrompt(brandSpec, imageCalloutsContent ?? undefined);
      if (viewAngle === "Mockup") return getPushupBraOnlyMockupPrompt(brandSpec, imageCalloutsContent ?? undefined);
      if (viewAngle === "Side") {
        return sideViewVariant === "SIDE_VIEW_2"
          ? getPushupBraOnlySide2Prompt(brandSpec, imageCalloutsContent ?? undefined)
          : getPushupBraOnlySide1Prompt(brandSpec, imageCalloutsContent ?? undefined);
      }
      return getPushupBraOnlyFrontPrompt(brandSpec);
    }
    if (viewAngle === "Back") return getPushupBackPrompt(brandSpec, imageCalloutsContent ?? undefined);
    if (viewAngle === "Mood") return getPushupMoodPrompt(brandSpec, imageCalloutsContent ?? undefined);
    if (viewAngle === "Zoom") return getPushupZoomPrompt(brandSpec, imageCalloutsContent ?? undefined);
    if (viewAngle === "Mockup") return getPushupMockupPrompt(brandSpec, imageCalloutsContent ?? undefined);
    if (viewAngle === "Side") {
      return sideViewVariant === "SIDE_VIEW_2"
        ? getPushupSide2Prompt(brandSpec, imageCalloutsContent ?? undefined)
        : getPushupSide1Prompt(brandSpec, imageCalloutsContent ?? undefined);
    }
    return getPushupFrontPrompt(brandSpec);
  }

  if (mode === "BRA_ONLY") {
    if (viewAngle === "Front") return getBraOnlyFrontPrompt(brandSpec);
    if (viewAngle === "Side") {
      return sideViewVariant === "SIDE_VIEW_2"
        ? getBraOnlySide2Prompt(brandSpec, imageCalloutsContent ?? undefined)
        : getBraOnlySide1Prompt(brandSpec, imageCalloutsContent ?? undefined);
    }
    if (viewAngle === "Back") return getBraOnlyBackPrompt(brandSpec, imageCalloutsContent ?? undefined);
    if (viewAngle === "Mood") return getBraOnlyMoodPrompt(brandSpec, imageCalloutsContent ?? undefined);
    if (viewAngle === "Zoom") return getBraOnlyZoomPrompt(brandSpec, imageCalloutsContent ?? undefined);
    if (viewAngle === "Mockup") return getBraOnlyMockupPrompt(brandSpec, imageCalloutsContent ?? undefined);
    return getBraOnlyFrontPrompt(brandSpec);
  }

  if (viewAngle === "Back") return getPantyOnlyBackViewPrompt(PANTY_ONLY_NEUTRAL_DIRECTION);
  if (viewAngle === "Side") return getPantyOnlySideViewPrompt(PANTY_ONLY_NEUTRAL_DIRECTION);
  if (viewAngle === "Mood") return getPantyOnlyMoodViewPrompt(PANTY_ONLY_NEUTRAL_DIRECTION);
  if (viewAngle === "Front") return getPantyOnlyFrontViewPrompt(PANTY_ONLY_NEUTRAL_DIRECTION);
  return getPantyOnlyFrontViewPrompt(PANTY_ONLY_NEUTRAL_DIRECTION);
};

const getSystemInstruction = (mode: ShootMode, viewAngle?: ViewAngle, pushupBraOnly = false): string => {
  if (viewAngle === "Mockup") {
    return "You are a professional digital fashion product compositor. Create a premium e-commerce product mockup using only the bra product reference image provided. No model, no panty — produce a clean, high-quality product-only display shot with callout annotations as instructed.";
  }
  if (mode === "PUSHUP" && pushupBraOnly) {
    return "You are a professional digital fashion compositor for push-up bra-only catalog imagery. Combine the adult model with the push-up bra product reference only. The output must be a modest head-to-navel crop with no panty, no lower garment, no hips, no thighs, and no lower body. Preserve the model's natural torso proportions without exaggerating the waist or curves.";
  }
  if (mode === "BRA_ONLY") {
    return "You are a professional digital fashion compositor. Combine the model with the bra product reference only into a premium studio e-commerce image. Keep the model fully clothed, preserve garment details exactly, maintain realistic fit, and keep the result strictly non-suggestive, retail-catalog safe, and suitable for a general audience.";
  }
  if (mode === "BRA_AND_PANTY") {
    return "You are a professional digital fashion compositor. Combine the model with both product references (bra + panty) into a premium studio e-commerce image. Keep the model fully clothed, preserve garment details exactly, maintain realistic fit, and keep the result strictly non-suggestive, retail-catalog safe, and suitable for a general audience.";
  }
  if (mode === "PUSHUP") {
    return "You are a professional digital fashion compositor for push-up bra catalog imagery. Combine the model with bra + panty product references into a premium e-commerce image. Preserve garment details exactly, emphasize the push-up construction in a natural commercial way, keep the model fully clothed, non-suggestive, modest, and suitable for a general audience.";
  }
  return "You are a professional digital fashion compositor. Combine the model with the panty product reference only, preserving exact product construction and realistic fit. Keep the model fully clothed, and keep output clean, modest, non-suggestive, and professional for a general audience e-commerce catalog.";
};

const LS_KEY = 'gemini_api_key';

export const getStoredApiKey = (): string => {
  return localStorage.getItem(LS_KEY) || '';
};

export const setStoredApiKey = (key: string): void => {
  localStorage.setItem(LS_KEY, key.trim());
};

export const clearStoredApiKey = (): void => {
  localStorage.removeItem(LS_KEY);
};

export const checkApiKey = async (): Promise<boolean> => {
  if (getStoredApiKey()) return true;
  if (typeof window !== "undefined" && (window as any).aistudio) {
    return await (window as any).aistudio.hasSelectedApiKey();
  }
  return false;
};

export const requestApiKey = async (): Promise<boolean> => {
  if (typeof window !== "undefined" && (window as any).aistudio) {
    await (window as any).aistudio.openSelectKey();
    return true;
  }
  return false;
};

export const generateShoot = async ({
  modelBase64,
  pantyBase64 = null,
  braBase64 = null,
  userPrompt,
  imageCalloutsContent = null,
  aspectRatio = "3:4",
  viewAngle = "Front",
  sideViewVariant = "SIDE_VIEW_1",
  frontViewVariant = "FRONT_SHOOT",
  shootMode,
  pushupBraOnly = false,
  brand = "dressberry",
  aiModel = "gemini-3.1-flash-image-preview",
}: GenerateShootParams): Promise<string> => {
  const mode: ShootMode = shootMode ?? (braBase64 && pantyBase64 ? "BRA_AND_PANTY" : braBase64 ? "BRA_ONLY" : "PANTY_ONLY");
  const isPushupBraOnly = mode === "PUSHUP" && pushupBraOnly;
  

  const modelImage = parseBase64Image(modelBase64);
  const pantyImage = pantyBase64 ? parseBase64Image(pantyBase64) : null;
  const braImage = braBase64 ? parseBase64Image(braBase64) : null;

  const resolvedKey = getStoredApiKey();
  if (!resolvedKey) throw new Error('No API key found. Please enter your Gemini API key.');
  const ai = new GoogleGenAI({ apiKey: resolvedKey });
  const selectedBrand = getBrandSpecification(brand);

  const sanitizedImageCallouts = sanitizeImageCalloutsForPrompt(
    mode,
    viewAngle,
    imageCalloutsContent
  );

  const promptInstructions = getPromptByModeAndAngle(
    mode,
    viewAngle,
    selectedBrand,
    sideViewVariant,
    frontViewVariant,
    sanitizedImageCallouts,
    isPushupBraOnly
  );

  const trimmedUserPrompt = userPrompt.trim();

  // If the user pasted a full custom prompt (>150 chars), use it as the PRIMARY instruction
  // and skip the structured prompt from Prompts.txt. This makes Creative Direction actually work
  // when a user pastes their own full prompt into the field.
  // Short inputs (<= 150 chars) are treated as supplementary direction appended to the structured prompt.
  const isFullCustomPrompt = trimmedUserPrompt.length > 150;

  // Mockup is a product-only shot — model and panty preambles don't apply.
  const isMockupShot = viewAngle === "Mockup";
  // BRA_ONLY model shots (not Mood, not Mockup) must enforce head-to-navel framing.
  const isBraOnlyModelShot = mode === "BRA_ONLY" && !isMockupShot && viewAngle !== "Mood";

  const safetyPreamble =
    "This is a fully clothed fashion catalog image for an adult model. Keep the pose natural and professional, avoid nudity, avoid suggestive framing, and keep the product presentation commercial and modest.";

  

  const resolutionHint =
    aspectRatio === "3:4" ? "Image Resolution: 1792x2400 pixels." : "";

  let mainPromptText: string;
  const calloutLayoutInstruction = sanitizedImageCallouts
    ? `CRITICAL LAYOUT & COLOR RULE (ABSOLUTE PRIORITY): All callout boxes, text, lines, icons, and annotations MUST be placed ENTIRELY in the blank background space surrounding the model. They MUST NOT touch, overlap, or obscure the model's skin, body, or garments in any way. Keep the model and product 100% visible and unobstructed by any graphics. Furthermore, ALL text, pointer lines, and callout icons MUST be rendered in exact brand color ${selectedBrand.fontHex}. Absolutely NO black (#000000), gray, or generic dark text is allowed. DO NOT generate or include any watermarks, logos, or brand marks.`
    : "DO NOT generate or include any watermarks, logos, or brand marks.";

  if (isPushupBraOnly) {
    const pushupBraOnlyBrandFrameInstruction = buildPushupBraOnlyBrandFrameInstruction(selectedBrand);
    const pushupBraOnlyCanvasInstruction = buildPushupBraOnlyCanvasInstruction(viewAngle, sideViewVariant);
    mainPromptText = [
      FRESH_START_HEADER,
      !isMockupShot ? safetyPreamble : "",
      !isMockupShot ? PUSHUP_BRA_ONLY_FRAME_INSTRUCTION : "",
      !isMockupShot ? buildBrandDirectionBlock(selectedBrand) : "",
      !isMockupShot ? pushupBraOnlyBrandFrameInstruction : "",
      !isMockupShot ? pushupBraOnlyCanvasInstruction : "",
      promptInstructions,
      !isMockupShot ? PUSHUP_BRA_ONLY_FRAME_INSTRUCTION : "",
      !isMockupShot ? pushupBraOnlyBrandFrameInstruction : "",
      !isMockupShot ? pushupBraOnlyCanvasInstruction : "",
      resolutionHint,
      `Aspect Ratio: ${aspectRatio} strict.`,
    ]
      .filter(Boolean)
      .join("\n\n");
  } else if (isFullCustomPrompt) {
    // Custom full-prompt mode: user's text is the main instruction.
    // Brand block is still injected so colors and fonts are always correct.
    mainPromptText = [
      FRESH_START_HEADER,
      isBraOnlyModelShot ? BRA_ONLY_FRAME_INSTRUCTION : "",
      !isMockupShot && (mode === "BRA_AND_PANTY" || mode === "PUSHUP") ? COLOR_LOCK_PREAMBLE : "",
      !isMockupShot ? safetyPreamble : "",
      !isMockupShot ? SKIN_QUALITY_INSTRUCTION : "",
      (mode === "BRA_AND_PANTY" || mode === "PUSHUP" || mode === "BRA_ONLY") ? buildBrandDirectionBlock(selectedBrand) : "",
      calloutLayoutInstruction,
      trimmedUserPrompt,
      resolutionHint,
      `Aspect Ratio: ${aspectRatio} strict.`,
    ]
      .filter(Boolean)
      .join("\n\n");
  } else {
    // Standard mode: structured prompt + optional short creative direction placed before it
    // so it has priority over the default copy inside the structured prompt.
    mainPromptText = [
      FRESH_START_HEADER,
      isBraOnlyModelShot ? BRA_ONLY_FRAME_INSTRUCTION : "",
      !isMockupShot && (mode === "BRA_AND_PANTY" || mode === "PUSHUP") ? COLOR_LOCK_PREAMBLE : "",
      !isMockupShot ? safetyPreamble : "",
      !isMockupShot ? SKIN_QUALITY_INSTRUCTION : "",
      calloutLayoutInstruction,
      trimmedUserPrompt
        ? `CREATIVE DIRECTION (apply this to the generated image):\n${trimmedUserPrompt}`
        : "",
      promptInstructions,
      resolutionHint,
      `Aspect Ratio: ${aspectRatio} strict.`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  // Mockup is a product-only shot — send only the bra image, skip model and panty.
  // BRA_ONLY sends model + bra, no panty.
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> =
    isPushupBraOnly && isMockupShot && braImage
      ? [
          { text: mainPromptText },
          { inlineData: { mimeType: braImage.mimeType, data: braImage.data } },
        ]
      : isPushupBraOnly && braImage
        ? [
            { text: mainPromptText },
            { inlineData: { mimeType: modelImage.mimeType, data: modelImage.data } },
            { inlineData: { mimeType: braImage.mimeType, data: braImage.data } },
          ]
      : isMockupShot && braImage
      ? [
          { text: mainPromptText },
          { text: "Image 1: Bra Product" },
          { inlineData: { mimeType: braImage.mimeType, data: braImage.data } },
        ]
      : [
          { text: mainPromptText },
          { text: "Image 1: Model" },
          { inlineData: { mimeType: modelImage.mimeType, data: modelImage.data } },
        ];

  if (!isMockupShot && !isPushupBraOnly) {
    if (mode === "BRA_ONLY" && braImage) {
      parts.push(
        { text: "Image 2: Bra Product" },
        { inlineData: { mimeType: braImage.mimeType, data: braImage.data } }
      );
    } else if ((mode === "BRA_AND_PANTY" || mode === "PUSHUP") && braImage && pantyImage) {
      parts.push(
        { text: "Image 2: Bra Product" },
        { inlineData: { mimeType: braImage.mimeType, data: braImage.data } },
        { text: "Image 3: Panty Product" },
        { inlineData: { mimeType: pantyImage.mimeType, data: pantyImage.data } }
      );
    } else if (pantyImage) {
      parts.push(
        { text: "Image 2: Panty Product" },
        { inlineData: { mimeType: pantyImage.mimeType, data: pantyImage.data } }
      );
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: aiModel,
      contents: { parts },
      config: {
        systemInstruction: getSystemInstruction(mode, viewAngle, isPushupBraOnly),
        imageConfig: { aspectRatio, imageSize: "2K" },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        ],
      },
    });

    const candidate = response.candidates?.[0];

    if (!candidate) {
      throw new Error("The model failed to generate a response. Please try again.");
    }

    if (candidate.finishReason === "SAFETY" || candidate.finishReason === "IMAGE_SAFETY") {
      throw new Error(
        "Safety Block: The generated image was flagged by content filters.\n\nTips:\n- Ensure source images are clean and catalog-style.\n- Avoid references that may be interpreted as unsafe or non-commercial content."
      );
    }

    const responseParts = candidate.content?.parts;

    if (responseParts) {
      let textContent = "";
      for (const part of responseParts) {
        if (part.inlineData?.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
        if (part.text) {
          textContent += `${part.text} `;
        }
      }
      if (textContent.trim().length > 0) {
        const cleanMsg = textContent.trim().replace(/\n/g, " ");
        throw new Error(`The model returned text instead of an image: "${cleanMsg}"`);
      }
    }

    throw new Error(
      `Generation failed. No image returned. Finish Reason: ${candidate.finishReason || "UNKNOWN"}.`
    );
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};
