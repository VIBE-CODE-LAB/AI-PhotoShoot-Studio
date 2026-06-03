# Context of Project

## Purpose and Scope
Simple PhotoShoot Studio is a React + Vite application that generates premium catalog-style product imagery by combining a model photo with product references (bra and/or panty). It guides a user through selecting pose, brand styling, and callouts, then builds a structured prompt for Gemini to synthesize a final image. The focus is on clean e-commerce outputs, precise product replication, and brand-locked typography and layout instructions.

This document is written to help another AI agent understand the full project context, the front-end UX flow, the prompt orchestration logic, and the file-level responsibilities.

## End-to-End Workflow (User Perspective)
1. Upload inputs
   - Model image is required.
   - Panty product image is required.
   - Bra product image is optional; adding it switches to Bra+Panty mode.
2. Configure the shoot
   - Select a view angle: Front, Side, Back, or Mood.
   - Select variant options for Front (Front Shoot or Front Push-Up) and Side (Side View 1 or 2).
   - Select a brand style (Bra+Panty only) to control background, colors, and typography.
   - Select aspect ratio and Gemini model.
3. Provide creative direction
   - Short notes (<= 150 chars) are appended to the structured prompt as higher-priority guidance.
   - Long notes (> 150 chars) replace the structured prompt entirely (brand direction still applies).
4. Optionally apply style presets
   - Presets can be loaded from local storage or synced from Google Sheets.
   - Selecting a preset auto-fills callout text and zones, and updates the pose selection.
5. Generate
   - The app assembles the prompt, injects safety and brand constraints, and submits reference images to Gemini.
   - The generated image is returned, displayed, and can be downloaded.
6. Usage gating
   - Free users get 3 generations, tracked in local storage.
   - A login modal unlocks unlimited usage after the limit is reached.

## Application Workflow (Technical Perspective)
### 1. Startup and Initialization
- The UI mounts in [index.tsx](index.tsx) and renders [App.tsx](App.tsx).
- On first render, [App.tsx](App.tsx) loads:
  - Usage count and Pro flag from local storage.
  - Style presets from local storage.
  - A saved Google Sheet URL and triggers auto-sync if present.

### 2. Core State Model (App.tsx)
The app keeps all UI state in [App.tsx](App.tsx):
- Image inputs: `modelImage`, `braProductImage`, `pantyProductImage`, `generatedImage`.
- Generation config: `viewAngle`, `sideViewVariant`, `frontViewVariant`, `aspectRatio`, `selectedBrand`, `selectedAiModel`.
- Prompt input: `creativeDirection`, `isImageCalloutsMode`, `imageCalloutsContent`.
- Preset management: `stylePresets`, `googleSheetUrl`, `stylePresetSearch`, `isSheetSyncing`.
- Access control: `usageCount`, `isPro`, `isLoginModalOpen`.
- Status handling: `status`, `errorMsg`.

The app derives several computed values:
- `generationMode`: `BRA_AND_PANTY` when model + panty + bra are present, otherwise `PANTY_ONLY`.
- `allowedAngles`: a list of valid angles based on `generationMode`.
- `activePromptFieldKeys`: which callout fields are editable for the current pose.

### 3. UI Event Flow
1. Image upload
   - Image inputs are handled by [components/ImageUploader.tsx](components/ImageUploader.tsx), which reads files as base64 strings and passes them back to App state.
2. Pose selection
   - `viewAngle` is set by clicking buttons or select boxes.
   - `sideViewVariant` and `frontViewVariant` are only enabled when model + bra + panty are present.
3. Brand selection
   - Brand tiles map to the list in [services/brandSpecifications.ts](services/brandSpecifications.ts).
   - Disabled unless in Bra+Panty mode.
4. Preset selection
   - Presets are filtered by search and selected via a dropdown.
   - On selection, the callout fields are auto-filled and the pose is set using preset config.
5. Callout mode toggle
   - A toggle switches between creative direction input and callout form inputs.
6. Generation
   - Clicking Generate invokes `handleGenerate`, which checks gating, builds prompt inputs, and calls the Gemini service.

### 4. Local Storage Responsibilities
Stored keys:
- `belle_usage_count` and `belle_is_pro` for gating.
- `belle_style_presets` for the local preset cache.
- `belle_style_presets_google_sheet_url` for auto-syncing presets on load.

## Prompt and Generation Pipeline
### Source Prompt Templates
Base prompt templates are stored in [Prompts.txt](Prompts.txt). These include view-specific layouts, pose guidance, and formatting rules.

### Prompt Builders and Overrides
- [services/prompt.ts](services/prompt.ts) parses the base prompt text and builds the final prompt based on:
  - View angle
  - Side/Front variants
  - Callout text and zone tags
  - Brand styling rules
- The file includes a detailed callout icon system, with explicit instructions for icon shape, placement, lines, and typography.

### Callout Zone System
Callout zones are controlled by `ImageCalloutsContent` in [types.ts](types.ts):
- Each callout has a text value and an optional zone tag (e.g., `armhole`, `band`, `strap`).
- If a zone is `auto`, the app attempts keyword detection to select a zone.
- Zone rules define icon shapes and target areas for the prompt.

### Prompt Assembly (Gemini Service)
The generation workflow is in [services/geminiService.ts](services/geminiService.ts):
1. Parse uploaded images to inline data (base64 + mime type).
2. Decide mode: Bra+Panty vs Panty-only.
3. Fetch brand specs and apply brand direction block if Bra+Panty.
4. Select the view-specific prompt:
   - Side view supports two variants.
   - Front view supports Front Shoot or Front Push-Up.
   - Back and Mood have their own templates.
5. Determine prompt mode:
   - Full custom prompt if user input is > 150 chars.
   - Otherwise, use structured prompt plus optional creative direction.
6. Inject global constraints:
   - Fresh generation directive.
   - Color lock for Bra+Panty mode.
   - Skin tone and lighting consistency rules.
   - Safety and modesty constraints.
7. Submit the prompt and images to Gemini using `GoogleGenAI`.

### API Key Handling
Gemini API keys are obtained from:
- `process.env.API_KEY` if available.
- AI Studio key selection via `window.aistudio` when running in the hosted environment.

## Frontend UI Layout (High-Level)
### Header
- App badge + name.
- Free plan usage indicator or Pro status.
- Login link for access unlocking.

### Main Content Structure
Two-column layout on large screens:
- Left column: setup and configuration
  - Setup instructions and guide download link.
  - Image uploaders for model, bra, panty.
  - Camera angle and pose selection.
  - Brand styling selection (Bra+Panty only).
  - Aspect ratio selection.
  - Gemini model selection.
  - Style preset search + sync.
  - Creative direction or callout entry panel.
  - Generate button and status feedback.
- Right column: output
  - Generated image display.
  - Download control (after generation).
  - Error or success messaging.

### Visual Language and Interaction
- Soft, premium styling with rounded cards and light borders.
- Brand palettes are surfaced via button swatches.
- UI uses simple, dense layout to keep the workflow fast and focused.

## Detailed File Responsibilities
- [App.tsx](App.tsx)
  - Main app component, UI orchestration, and business logic.
  - Controls state, handles user actions, builds generation payloads.
- [index.tsx](index.tsx)
  - React entry point and root render.
- [components/ImageUploader.tsx](components/ImageUploader.tsx)
  - Drag-and-drop and click-to-upload file handling.
  - Converts images to base64 data URLs.
- [components/Button.tsx](components/Button.tsx)
  - Reusable button styles and loading indicator.
- [components/LoginModal.tsx](components/LoginModal.tsx)
  - Access modal with password gating for Pro unlock.
- [services/geminiService.ts](services/geminiService.ts)
  - Gemini integration, prompt assembly, image parsing, safety constraints.
- [services/prompt.ts](services/prompt.ts)
  - Prompt templates and callout override builders.
  - Zone icon rules and layout-specific callout placement rules.
- [services/stylePresets.ts](services/stylePresets.ts)
  - Preset parsing, pose mapping, Google Sheet sync, local storage helpers.
- [services/brandSpecifications.ts](services/brandSpecifications.ts)
  - Brand palette, typography, background colors, and look-and-feel notes.
- [types.ts](types.ts)
  - Shared enums and types for view angles, modes, callout zones, and status.
- [Prompts.txt](Prompts.txt)
  - Base structured prompt templates for each view and variant.
- [README.md](README.md)
  - Run instructions for local development.

## Important Behavior Notes and Constraints
- The app requires a model + panty image to generate anything.
- Bra+Panty mode triggers strict color harmonization instructions.
- Side/Back/Mood views use editable callout fields and zone tagging; Front does not.
- Full custom prompts do not bypass brand constraints.
- Output image resolution hint is included only for 3:4 aspect ratio.

## Minimal Run Setup
1. Install dependencies: `npm install`
2. Set `GEMINI_API_KEY` in `.env.local`.
3. Start app: `npm run dev`
