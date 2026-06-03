export interface ImageAsset {
  id: string;
  data: string; // Base64 string including mime type prefix
  mimeType: string;
  source: 'upload' | 'generated';
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  PREPARING = 'PREPARING',
  GENERATING = 'GENERATING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export interface GenerationConfig {
  promptModifier: string;
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9';

export type ViewAngle = 'Front' | 'Side' | 'Back' | 'Mood' | 'Zoom' | 'Mockup';

export type ShootMode = 'BRA_AND_PANTY' | 'PANTY_ONLY' | 'PUSHUP' | 'BRA_ONLY';

export type SideViewVariant = 'SIDE_VIEW_1' | 'SIDE_VIEW_2';

export type FrontViewVariant = 'FRONT_SHOOT' | 'FRONT_PUSH_UP';

// Zone tags drive the icon illustration and pointer zone in callout prompts.
// 'auto' means detect from callout text keywords automatically.
export type CalloutZone =
  | 'auto'
  | 'armhole'
  | 'band'
  | 'strap'
  | 'hook'
  | 'wing'
  | 'fabric'
  | 'padding'
  | 'gripper'
  | 'w_hold'
  | 'vneck'
  | 'coverage'
  | 'u_back'
  | 'spillage';

export interface ImageCalloutsContent {
  heading?: string;
  subHead?: string;
  callout1?: string;
  callout2?: string;
  callout3?: string;
  callout4?: string;
  // Zone tags for each callout — control icon illustration and pointer zone
  zone1?: CalloutZone;
  zone2?: CalloutZone;
  zone3?: CalloutZone;
  zone4?: CalloutZone;
}
