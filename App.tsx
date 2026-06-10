import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { LoginModal } from './components/LoginModal';
import { clearStoredApiKey, getStoredApiKey } from './services/geminiService';
import {
  AspectRatio,
  CalloutZone,
  FrontViewVariant,
  GenerationStatus,
  ImageCalloutsContent,
  ShootMode,
  SideViewVariant,
  ViewAngle,
} from './types';
import { checkApiKey, generateShoot, requestApiKey } from './services/geminiService';
import { BRAND_SPECIFICATIONS, BRAND_SPECIFICATIONS_BY_ID } from './services/brandSpecifications';
import {
  type StylePreset,
  type PresetPose,
  fetchStylePresetsFromGoogleSheet,
  findPreset,
  getPoseConfig,
  getPresetOptions,
  loadGoogleSheetUrlFromStorage,
  loadPresetsFromStorage,
  presetToCalloutsContent,
  removeGoogleSheetUrlFromStorage,
  saveGoogleSheetUrlToStorage,
  savePresetsToStorage,
} from './services/stylePresets';
import './design_b_full_window_horizontal.css';

const ALL_ANGLES: ViewAngle[] = ['Front', 'Side', 'Back', 'Mood', 'Zoom', 'Mockup'];
const ALLOWED_ANGLES_BY_MODE: Record<ShootMode, ViewAngle[]> = {
  BRA_AND_PANTY: ['Front', 'Side', 'Back', 'Mood', 'Zoom', 'Mockup'],
  PANTY_ONLY: ['Front', 'Side', 'Back', 'Mood'],
  PUSHUP: ['Front', 'Side', 'Back', 'Mood', 'Zoom', 'Mockup'],
  BRA_ONLY: ['Front', 'Side', 'Back', 'Mood', 'Zoom', 'Mockup'],
};

type SequenceStep = {
  id: string;
  viewAngle: ViewAngle;
  sideViewVariant?: SideViewVariant;
  frontViewVariant?: FrontViewVariant;
  presetPose?: PresetPose;
};

// zoneKey maps each callout field to its matching zone selector field.
const IMAGE_CALLOUT_FIELDS: Array<{
  key: keyof ImageCalloutsContent;
  label: string;
  placeholder: string;
  zoneKey?: keyof ImageCalloutsContent;
}> = [
  { key: 'heading', label: 'Heading', placeholder: 'Elastic-Free Construction' },
  { key: 'subHead', label: 'Sub-Head', placeholder: 'No Digging. No Marks. No Itching.' },
  {
    key: 'callout1',
    label: 'Callout 1',
    placeholder: 'Elastic-free Armhole / for Rashfree Comfort',
    zoneKey: 'zone1',
  },
  {
    key: 'callout2',
    label: 'Callout 2',
    placeholder: 'Elastic-free Bottom Band / for Seamless Support',
    zoneKey: 'zone2',
  },
  {
    key: 'callout3',
    label: 'Callout 3',
    placeholder: 'Seamless Design / Invisible under Outfits',
    zoneKey: 'zone3',
  },
  {
    key: 'callout4',
    label: 'Callout 4 (Mood only)',
    placeholder: 'No Spillage / No Side Bulges',
    zoneKey: 'zone4',
  },
];

// Zone label options shown in the icon zone selector dropdown.
const ZONE_OPTIONS: Array<{ value: CalloutZone; label: string }> = [
  { value: 'auto', label: 'Auto-Detect Icon' },
  { value: 'armhole', label: 'Armhole Edge' },
  { value: 'band', label: 'Bottom Band' },
  { value: 'strap', label: 'Shoulder Strap' },
  { value: 'hook', label: 'Hook Closure' },
  { value: 'wing', label: 'Side Wing' },
  { value: 'fabric', label: 'Fabric / Cotton' },
  { value: 'padding', label: 'Padding / Lift' },
  { value: 'gripper', label: 'Gripper' },
  { value: 'w_hold', label: 'W-Hold Design' },
  { value: 'vneck', label: 'V-Neckline' },
  { value: 'coverage', label: 'Full Coverage' },
  { value: 'u_back', label: 'U-Back' },
  { value: 'spillage', label: 'Side Panel' },
];

const getActivePromptFieldKeys = (
  mode: ShootMode | null,
  angle: ViewAngle,
  sideVariant: SideViewVariant
): Array<keyof ImageCalloutsContent> => {
  if (mode !== 'BRA_AND_PANTY' && mode !== 'PUSHUP' && mode !== 'BRA_ONLY') return [];
  if (angle === 'Mood' || angle === 'Mockup') return ['heading', 'subHead', 'callout1', 'callout2', 'callout3', 'callout4'];
  if (angle === 'Back' || angle === 'Side' || angle === 'Zoom') return ['heading', 'subHead', 'callout1', 'callout2', 'callout3'];
  return [];
};

const App = () => {
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [braProductImage, setBraProductImage] = useState<string | null>(null);
  const [pantyProductImage, setPantyProductImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [creativeDirection, setCreativeDirection] = useState<string>('');
  const [isImageCalloutsMode, setIsImageCalloutsMode] = useState<boolean>(false);
  const [imageCalloutsContent, setImageCalloutsContent] = useState<ImageCalloutsContent>({
    heading: '',
    subHead: '',
    callout1: '',
    callout2: '',
    callout3: '',
    callout4: '',
    zone1: 'auto',
    zone2: 'auto',
    zone3: 'auto',
    zone4: 'auto',
  });
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:4');
  const [viewAngle, setViewAngle] = useState<ViewAngle>('Side');
  const [sideViewVariant, setSideViewVariant] = useState<SideViewVariant>('SIDE_VIEW_1');
  const [frontViewVariant, setFrontViewVariant] = useState<FrontViewVariant>('FRONT_SHOOT');
  const [selectedBrand, setSelectedBrand] = useState<string>('dressberry');
  const [selectedAiModel, setSelectedAiModel] = useState<string>('gemini-3.1-flash-image-preview');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ShootMode>('PANTY_ONLY');
  const [pushupBraOnly, setPushupBraOnly] = useState<boolean>(false);
  const [sequenceMode, setSequenceMode] = useState<'auto' | 'custom'>('auto');
  const [customSequence, setCustomSequence] = useState<ViewAngle[]>([]);
  const [reviewImages, setReviewImages] = useState<Array<{ id: string; src: string; pose: string; ratio: string }>>([]);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackSelections, setFeedbackSelections] = useState({ poses: false, brand: false, content: false });
  const [autoGenerateTarget, setAutoGenerateTarget] = useState<SequenceStep | null>(null);
  const generationRunRef = useRef(0);
  const [isBackReferenceModalOpen, setIsBackReferenceModalOpen] = useState(false);
  const [pendingBackAutoGenerate, setPendingBackAutoGenerate] = useState(false);
  const [hasUsedBackReferencesInSequence, setHasUsedBackReferencesInSequence] = useState(false);
  const [backModelImage, setBackModelImage] = useState<string | null>(null);
  const [backBraProductImage, setBackBraProductImage] = useState<string | null>(null);
  const [backPantyProductImage, setBackPantyProductImage] = useState<string | null>(null);

  const [isOptionalPoseModalOpen, setIsOptionalPoseModalOpen] = useState(false);
  const [pendingOptionalGenerateParams, setPendingOptionalGenerateParams] = useState<any>(null);

  const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
  const [selectedPresetStyleName, setSelectedPresetStyleName] = useState<string | null>(null);
  const [selectedPresetPose, setSelectedPresetPose] = useState<PresetPose | null>(null);
  const [csvImportMsg, setCsvImportMsg] = useState<string | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>('');
  const [stylePresetSearch, setStylePresetSearch] = useState<string>('');
  const [isSheetSyncing, setIsSheetSyncing] = useState<boolean>(false);

  const [usageCount, setUsageCount] = useState<number>(0);
  const [isPro, setIsPro] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const hasModel = Boolean(modelImage);
  const hasBra = Boolean(braProductImage);
  const hasPanty = Boolean(pantyProductImage);
  const isBraPantyMode = selectedMode === 'BRA_AND_PANTY';
  const isPushupMode = selectedMode === 'PUSHUP';
  const isBraOnlyMode = selectedMode === 'BRA_ONLY';
  const isPushupBraOnlyMode = isPushupMode && pushupBraOnly;
  const needsBraProduct = selectedMode !== 'PANTY_ONLY';
  const needsPantyProduct = selectedMode === 'PANTY_ONLY' || selectedMode === 'BRA_AND_PANTY' || (selectedMode === 'PUSHUP' && !pushupBraOnly);
  const canGenerate = hasModel && (!needsBraProduct || hasBra) && (!needsPantyProduct || hasPanty);

  const generationMode: ShootMode | null = useMemo(() => {
    if (selectedMode === 'BRA_ONLY') return hasModel && hasBra ? 'BRA_ONLY' : null;
    if (!hasModel) return null;
    if (selectedMode === 'BRA_AND_PANTY') return hasBra ? 'BRA_AND_PANTY' : null;
    if (selectedMode === 'PUSHUP') return hasBra && (isPushupBraOnlyMode || hasPanty) ? 'PUSHUP' : null;
    return 'PANTY_ONLY';
  }, [hasBra, hasModel, hasPanty, isPushupBraOnlyMode, selectedMode]);

  const canUseSidePromptVariants = needsBraProduct && hasModel && hasBra && (isBraOnlyMode || hasPanty || isPushupBraOnlyMode);
  const canUseFrontPromptVariants = isBraPantyMode && hasModel && hasBra && hasPanty;
  const allowedAngles = ALLOWED_ANGLES_BY_MODE[selectedMode];
  const remainingGenerations = Math.max(0, 3 - usageCount);
  const slotTotal = 1 + (needsBraProduct ? 1 : 0) + (needsPantyProduct ? 1 : 0);
  const slotAdded = [hasModel, needsBraProduct ? hasBra : false, needsPantyProduct ? hasPanty : false].filter(Boolean).length;
  const requiredCount = slotTotal;
  const requiredAdded = slotAdded;
  const awaitingCount = Math.max(0, requiredCount - requiredAdded);
  const activeBrand = BRAND_SPECIFICATIONS_BY_ID[selectedBrand];
  const modeLabel = selectedMode === 'PUSHUP' ? 'Pushup' : selectedMode === 'BRA_AND_PANTY' ? 'Bra + Panty' : selectedMode === 'BRA_ONLY' ? 'Bra' : 'Panty';
  const displayModeLabel = generationMode ? modeLabel : 'Setup';
  const ratioLabel = aspectRatio === '21:9' ? 'A4+' : aspectRatio;
  const poseLabel = viewAngle === 'Front'
    ? frontViewVariant === 'FRONT_PUSH_UP'
      ? 'Front Push-Up'
      : 'Front'
    : viewAngle === 'Side'
      ? sideViewVariant === 'SIDE_VIEW_2'
        ? 'Side 2'
        : 'Side'
      : viewAngle;
  const engineLabel = selectedAiModel === 'gemini-3-pro-image-preview' ? 'Gemini 3 Pro' : '3.1 Fast';
  const latestImage = reviewImages.length > 0 ? reviewImages[reviewImages.length - 1] : null;
  const previewPair = reviewImages.slice(-2);

  const defaultSequence: SequenceStep[] = isPushupMode
    ? [
        { id: 'push_up', viewAngle: 'Front', frontViewVariant: 'FRONT_PUSH_UP', presetPose: 'push_up' },
        { id: 'side1', viewAngle: 'Side', sideViewVariant: 'SIDE_VIEW_1', presetPose: 'side1' },
        { id: 'side2', viewAngle: 'Side', sideViewVariant: 'SIDE_VIEW_2', presetPose: 'side2' },
        { id: 'back', viewAngle: 'Back', presetPose: 'back' },
        { id: 'mood', viewAngle: 'Mood', presetPose: 'mood' },
        { id: 'zoom', viewAngle: 'Zoom', presetPose: 'zoom' },
        { id: 'mockup', viewAngle: 'Mockup', presetPose: 'mockup' },
      ]
    : isBraPantyMode
      ? [
          { id: 'front', viewAngle: 'Front', frontViewVariant: 'FRONT_SHOOT', presetPose: 'front' },
          { id: 'side1', viewAngle: 'Side', sideViewVariant: 'SIDE_VIEW_1', presetPose: 'side1' },
          { id: 'side2', viewAngle: 'Side', sideViewVariant: 'SIDE_VIEW_2', presetPose: 'side2' },
          { id: 'back', viewAngle: 'Back', presetPose: 'back' },
          { id: 'mood', viewAngle: 'Mood', presetPose: 'mood' },
          { id: 'zoom', viewAngle: 'Zoom', presetPose: 'zoom' },
          { id: 'mockup', viewAngle: 'Mockup', presetPose: 'mockup' },
        ]
      : isBraOnlyMode
        ? [
            { id: 'front', viewAngle: 'Front', frontViewVariant: 'FRONT_SHOOT', presetPose: 'front' },
            { id: 'side1', viewAngle: 'Side', sideViewVariant: 'SIDE_VIEW_1', presetPose: 'side1' },
            { id: 'side2', viewAngle: 'Side', sideViewVariant: 'SIDE_VIEW_2', presetPose: 'side2' },
            { id: 'back', viewAngle: 'Back', presetPose: 'back' },
            { id: 'mood', viewAngle: 'Mood', presetPose: 'mood' },
            { id: 'zoom', viewAngle: 'Zoom', presetPose: 'zoom' },
            { id: 'mockup', viewAngle: 'Mockup', presetPose: 'mockup' },
          ]
        : [
            { id: 'front', viewAngle: 'Front' },
            { id: 'side', viewAngle: 'Side' },
            { id: 'back', viewAngle: 'Back' },
            { id: 'mood', viewAngle: 'Mood' },
          ];
  const activeSequence: SequenceStep[] = sequenceMode === 'custom' && customSequence.length > 0
    ? customSequence.map((angle) => {
        const defaultMatch = defaultSequence.find((s) => s.viewAngle === angle);
        return {
          id: angle.toLowerCase(),
          viewAngle: angle,
          sideViewVariant: defaultMatch?.sideViewVariant,
          frontViewVariant: defaultMatch?.frontViewVariant,
          presetPose: defaultMatch?.presetPose,
        };
      })
    : defaultSequence;

  useEffect(() => {
    const savedCount = localStorage.getItem('belle_usage_count');
    const savedPro = localStorage.getItem('belle_is_pro');
    if (savedCount) setUsageCount(parseInt(savedCount, 10));
    // Auto-unlock Pro if a valid API key is already stored in the browser
    if (savedPro === 'true' && getStoredApiKey()) setIsPro(true);
    setStylePresets(loadPresetsFromStorage());

    const savedSheetUrl = loadGoogleSheetUrlFromStorage();
    if (savedSheetUrl) {
      setGoogleSheetUrl(savedSheetUrl);
      syncGoogleSheetPresets(savedSheetUrl, true);
    }
  }, []);

  useEffect(() => {
    if (!allowedAngles.includes(viewAngle)) setViewAngle('Side');
  }, [allowedAngles, viewAngle]);

  useEffect(() => {
    if (!canUseSidePromptVariants && sideViewVariant !== 'SIDE_VIEW_1') {
      setSideViewVariant('SIDE_VIEW_1');
    }
  }, [canUseSidePromptVariants, sideViewVariant]);

  const handlePresetSelect = (value: string) => {
    if (!value) return;
    const separatorIdx = value.indexOf('||');
    if (separatorIdx === -1) return;
    const styleName = value.slice(0, separatorIdx);
    const pose = value.slice(separatorIdx + 2) as PresetPose;
    const preset = stylePresets.find((p) => p.styleName === styleName && p.pose === pose);
    if (!preset) return;

    setSelectedPresetStyleName(styleName);
    setSelectedPresetPose(pose);
    const numMatch = styleName.match(/\d+/);
    setStylePresetSearch(numMatch ? numMatch[0] : styleName);
    setImageCalloutsContent(presetToCalloutsContent(preset));
    setIsImageCalloutsMode(true);

    const config = getPoseConfig(pose);
    setViewAngle(config.viewAngle);
    if (config.sideViewVariant) setSideViewVariant(config.sideViewVariant);
    if (config.frontViewVariant) setFrontViewVariant(config.frontViewVariant);
  };

  const syncGoogleSheetPresets = async (url = googleSheetUrl, isAutoSync = false) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setCsvImportMsg('Paste a Google Sheet link first.');
      setTimeout(() => setCsvImportMsg(null), 4000);
      return;
    }

    setIsSheetSyncing(true);
    setCsvImportMsg(isAutoSync ? 'Refreshing presets from Google Sheet...' : 'Loading presets from Google Sheet...');

    try {
      const { presets, errors, debug } = await fetchStylePresetsFromGoogleSheet(trimmedUrl);
      if (presets.length === 0) {
        setCsvImportMsg(errors.length > 0 ? `Sheet sync failed: ${errors[0]}` : 'No valid rows found in Google Sheet.');
        return;
      }

      savePresetsToStorage(presets);
      saveGoogleSheetUrlToStorage(trimmedUrl);
      setStylePresets(presets);
      setGoogleSheetUrl(trimmedUrl);

      // Log genuine errors (unexpected pose names) to console for debugging
      if (errors.length > 0) {
        console.group('[StylePresets] Rows with unrecognized poses skipped:');
        errors.forEach((e) => console.warn(e));
        console.groupEnd();
      }

      // Only surface errors that indicate a real problem (unrecognized pose names).
      // Known content-type rows (Zoom Shot, Video, A+ Content, etc.) are silently skipped
      // and not counted as errors — so the success message stays clean.
      const errorNote = errors.length > 0
        ? ` — ${errors.length} unrecognized pose${errors.length !== 1 ? 's' : ''}: "${errors[0].match(/"([^"]+)" for/)?.[1] ?? errors[0]}"`
        : '';
      const style35Note = debug.parsedStyle35Count > 0
        ? ''
        : debug.csvContainsStyle35
          ? ' Style 35 exists in the sheet export but its image-pose rows were skipped. Check console for skipped-row details.'
          : ' Style 35 was not found in the fetched sheet tab/export. Copy the URL from the tab that contains style 35, then sync again.';
      setCsvImportMsg(`${presets.length} preset${presets.length !== 1 ? 's' : ''} synced from Google Sheet.${errorNote}${style35Note}`);
    } catch (error: any) {
      setCsvImportMsg(error.message || 'Google Sheet sync failed. Publish/share the Sheet and try again.');
    } finally {
      setIsSheetSyncing(false);
      setTimeout(() => setCsvImportMsg(null), 8000);
    }
  };

  const handleDisconnectGoogleSheet = () => {
    removeGoogleSheetUrlFromStorage();
    setGoogleSheetUrl('');
    setCsvImportMsg('Google Sheet disconnected. Existing loaded presets are still available.');
    setTimeout(() => setCsvImportMsg(null), 4000);
  };

  const handleLoginSuccess = () => {
    setIsPro(true);
    localStorage.setItem('belle_is_pro', 'true');
    setIsLoginModalOpen(false);
  };

  const handleLogout = () => {
    clearStoredApiKey();
    localStorage.removeItem('belle_is_pro');
    setIsPro(false);
  };

  const downloadImage = (src: string, label: string) => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `belle-studio-${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shouldRequestBackReferences = (angle: ViewAngle) =>
    angle === 'Back' && needsBraProduct && !hasUsedBackReferencesInSequence;

  const applySequenceStep = (step: SequenceStep) => {
    setViewAngle(step.viewAngle);
    if (step.sideViewVariant) setSideViewVariant(step.sideViewVariant);
    if (step.frontViewVariant) setFrontViewVariant(step.frontViewVariant);

    if (selectedPresetStyleName) {
      if (step.presetPose) {
        const preset = findPreset(stylePresets, selectedPresetStyleName, step.presetPose);
        if (preset) {
          setImageCalloutsContent(presetToCalloutsContent(preset));
          setIsImageCalloutsMode(true);
          setSelectedPresetPose(step.presetPose);
          const numMatch = preset.styleName.match(/\d+/);
          setStylePresetSearch(numMatch ? numMatch[0] : preset.styleName);
        } else {
          setImageCalloutsContent({ heading: '', subHead: '', callout1: '', callout2: '', callout3: '', callout4: '', zone1: 'auto', zone2: 'auto', zone3: 'auto', zone4: 'auto' });
          setSelectedPresetPose(null);
          setStylePresetSearch('');
        }
      } else {
        setImageCalloutsContent({ heading: '', subHead: '', callout1: '', callout2: '', callout3: '', callout4: '', zone1: 'auto', zone2: 'auto', zone3: 'auto', zone4: 'auto' });
        setSelectedPresetPose(null);
        setStylePresetSearch('');
      }
    }
  };

  const isCurrentSequenceStep = (step: SequenceStep) =>
    viewAngle === step.viewAngle &&
    (!step.sideViewVariant || sideViewVariant === step.sideViewVariant) &&
    (!step.frontViewVariant || frontViewVariant === step.frontViewVariant);

  const getPoseLabelForState = () => (
    viewAngle === 'Front'
      ? frontViewVariant === 'FRONT_PUSH_UP'
        ? 'Front Push-Up'
        : 'Front'
      : viewAngle === 'Side'
        ? sideViewVariant === 'SIDE_VIEW_2'
          ? 'Side 2'
          : 'Side'
        : viewAngle
  );

  const activePromptFieldKeys = getActivePromptFieldKeys(selectedMode, viewAngle, sideViewVariant);

  const skipToNextSequenceStep = () => {
    const currentIndex = activeSequence.findIndex(isCurrentSequenceStep);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % activeSequence.length;
    const nextStep = activeSequence[nextIndex];

    if (nextIndex === 0) {
      setHasUsedBackReferencesInSequence(false);
    }

    if (shouldRequestBackReferences(nextStep.viewAngle)) {
      setPendingBackAutoGenerate(true);
      applySequenceStep(nextStep);
      setIsBackReferenceModalOpen(true);
      return;
    }

    setAutoGenerateTarget(nextStep);
    applySequenceStep(nextStep);
  };

  const handleManualAngleChange = (angle: ViewAngle) => {
    setViewAngle(angle);
    if (selectedPresetStyleName) {
      const matchingStep = activeSequence.find(step => 
        step.viewAngle === angle && 
        (!step.sideViewVariant || step.sideViewVariant === sideViewVariant) && 
        (!step.frontViewVariant || step.frontViewVariant === frontViewVariant)
      );
      if (matchingStep && matchingStep.presetPose) {
        const preset = findPreset(stylePresets, selectedPresetStyleName, matchingStep.presetPose);
        if (preset) {
          setImageCalloutsContent(presetToCalloutsContent(preset));
          setIsImageCalloutsMode(true);
          setSelectedPresetPose(matchingStep.presetPose);
          const numMatch = preset.styleName.match(/\d+/);
          setStylePresetSearch(numMatch ? numMatch[0] : preset.styleName);
        } else {
          setImageCalloutsContent({ heading: '', subHead: '', callout1: '', callout2: '', callout3: '', callout4: '', zone1: 'auto', zone2: 'auto', zone3: 'auto', zone4: 'auto' });
          setSelectedPresetPose(null);
          setStylePresetSearch('');
        }
      } else {
        setImageCalloutsContent({ heading: '', subHead: '', callout1: '', callout2: '', callout3: '', callout4: '', zone1: 'auto', zone2: 'auto', zone3: 'auto', zone4: 'auto' });
        setSelectedPresetPose(null);
        setStylePresetSearch('');
      }
    }
  };

  const handleManualSideVariantChange = (variant: SideViewVariant) => {
    setSideViewVariant(variant);
    if (selectedPresetStyleName) {
      const matchingStep = activeSequence.find(step => 
        step.viewAngle === 'Side' && 
        step.sideViewVariant === variant &&
        (!step.frontViewVariant || step.frontViewVariant === frontViewVariant)
      );
      if (matchingStep && matchingStep.presetPose) {
        const preset = findPreset(stylePresets, selectedPresetStyleName, matchingStep.presetPose);
        if (preset) {
          setImageCalloutsContent(presetToCalloutsContent(preset));
          setIsImageCalloutsMode(true);
          setSelectedPresetPose(matchingStep.presetPose);
          const numMatch = preset.styleName.match(/\d+/);
          setStylePresetSearch(numMatch ? numMatch[0] : preset.styleName);
        } else {
          setImageCalloutsContent({ heading: '', subHead: '', callout1: '', callout2: '', callout3: '', callout4: '', zone1: 'auto', zone2: 'auto', zone3: 'auto', zone4: 'auto' });
          setSelectedPresetPose(null);
          setStylePresetSearch('');
        }
      } else {
        setImageCalloutsContent({ heading: '', subHead: '', callout1: '', callout2: '', callout3: '', callout4: '', zone1: 'auto', zone2: 'auto', zone3: 'auto', zone4: 'auto' });
        setSelectedPresetPose(null);
        setStylePresetSearch('');
      }
    }
  };

  const handleManualFrontVariantChange = (variant: FrontViewVariant) => {
    setFrontViewVariant(variant);
    if (selectedPresetStyleName) {
      const matchingStep = activeSequence.find(step => step.viewAngle === 'Front' && step.frontViewVariant === variant);
      if (matchingStep && matchingStep.presetPose) {
        const preset = findPreset(stylePresets, selectedPresetStyleName, matchingStep.presetPose);
        if (preset) {
          setImageCalloutsContent(presetToCalloutsContent(preset));
          setIsImageCalloutsMode(true);
          setSelectedPresetPose(matchingStep.presetPose);
        } else {
          setImageCalloutsContent({ heading: '', subHead: '', callout1: '', callout2: '', callout3: '', callout4: '', zone1: 'auto', zone2: 'auto', zone3: 'auto', zone4: 'auto' });
          setSelectedPresetPose(null);
        }
      } else {
        setImageCalloutsContent({ heading: '', subHead: '', callout1: '', callout2: '', callout3: '', callout4: '', zone1: 'auto', zone2: 'auto', zone3: 'auto', zone4: 'auto' });
        setSelectedPresetPose(null);
      }
    }
  };

  const handleGenerate = async (options: {
    modelOverride?: string | null;
    braOverride?: string | null;
    pantyOverride?: string | null;
    skipOptionalCheck?: boolean;
  } = {}): Promise<boolean> => {
    const modelForGeneration = options.modelOverride ?? modelImage;
    const braForGeneration = options.braOverride ?? braProductImage;
    const pantyForGeneration = options.pantyOverride ?? pantyProductImage;

    if (!modelForGeneration) {
      setErrorMsg('Please upload a model image to generate.');
      return false;
    }

    if (selectedMode === 'PANTY_ONLY') {
      if (!pantyForGeneration) {
        setErrorMsg('Please upload a model and panty image to generate.');
        return false;
      }
    } else {
      if (!braForGeneration) {
        setErrorMsg(`Please upload a ${isPushupMode ? 'pushup bra' : 'bra'} image to generate.`);
        return false;
      }
      if (needsPantyProduct && !pantyForGeneration) {
        setErrorMsg(`Please upload model, ${isPushupMode ? 'pushup bra' : 'bra'} and panty images to generate.`);
        return false;
      }
    }

    if (!options.skipOptionalCheck) {
      if (viewAngle === 'Front' || viewAngle === 'Zoom' || viewAngle === 'Mockup') {
        setIsOptionalPoseModalOpen(true);
        setPendingOptionalGenerateParams(options);
        return false;
      }
    }

    if (!isPro && usageCount >= 3) {
      setIsLoginModalOpen(true);
      return false;
    }

    const runId = generationRunRef.current + 1;
    generationRunRef.current = runId;
    setErrorMsg(null);
    setStatus(GenerationStatus.PREPARING);

    const userPrompt = isPushupBraOnlyMode
      ? ''
      : isImageCalloutsMode
        ? ''
        : creativeDirection.trim();

    // Build the callouts content object — always include zone tags alongside callout text.
    const normalizedImageCalloutsContent: ImageCalloutsContent | undefined = !isPushupBraOnlyMode && isImageCalloutsMode
      ? (() => {
          const acc = activePromptFieldKeys.reduce((obj, key) => {
            const value = imageCalloutsContent[key];
            if (value) obj[key] = value as any;
            return obj;
          }, {} as ImageCalloutsContent);

          // Always pass zone tags alongside their matching callout text.
          if (acc.callout1) acc.zone1 = imageCalloutsContent.zone1 || 'auto';
          if (acc.callout2) acc.zone2 = imageCalloutsContent.zone2 || 'auto';
          if (acc.callout3) acc.zone3 = imageCalloutsContent.zone3 || 'auto';
          if (acc.callout4) acc.zone4 = imageCalloutsContent.zone4 || 'auto';

          return acc;
        })()
      : undefined;

    const poseLabelForResult = getPoseLabelForState();
    const ratioLabelForResult = ratioLabel;

    try {
      const hasKey = await checkApiKey();
      if (!hasKey) {
        const requested = await requestApiKey();
        if (!requested) {
          throw new Error('API Key not found. Please set GEMINI_API_KEY in .env.local or select key in AI Studio.');
        }
        setStatus(GenerationStatus.IDLE);
        return false;
      }

      if (generationRunRef.current !== runId) return false;
      setStatus(GenerationStatus.GENERATING);
      const result = await generateShoot({
        modelBase64: modelForGeneration,
        braBase64: braForGeneration,
        pantyBase64: isBraOnlyMode || isPushupBraOnlyMode ? undefined : pantyForGeneration,
        userPrompt,
        imageCalloutsContent: normalizedImageCalloutsContent,
        aspectRatio,
        viewAngle,
        sideViewVariant,
        frontViewVariant,
        shootMode: selectedMode,
        pushupBraOnly: isPushupBraOnlyMode,
        brand: selectedBrand,
        aiModel: selectedAiModel,
      });

      if (generationRunRef.current !== runId) return false;
      setGeneratedImage(result);
      setStatus(GenerationStatus.COMPLETE);

      setReviewImages((current) => {
        const next = [...current, {
          id: `${Date.now()}-${poseLabelForResult}`,
          src: result,
          pose: poseLabelForResult,
          ratio: ratioLabelForResult,
        }];
        return next.length > 2 ? next.slice(-2) : next;
      });

      if (!isPro) {
        const newCount = usageCount + 1;
        setUsageCount(newCount);
        localStorage.setItem('belle_usage_count', newCount.toString());
      }
      return true;
    } catch (error: any) {
      if (generationRunRef.current !== runId) return false;
      setStatus(GenerationStatus.ERROR);
      setErrorMsg(error.message || 'An unexpected error occurred during generation.');
      return false;
    }
  };

  const handleStopGeneration = () => {
    generationRunRef.current += 1;
    setAutoGenerateTarget(null);
    setPendingBackAutoGenerate(false);
    setIsBackReferenceModalOpen(false);
    setStatus(GenerationStatus.IDLE);
    setErrorMsg('Generation stopped. Any late result from the interrupted request will be ignored.');
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    downloadImage(generatedImage, getPoseLabelForState());
  };

  const handleGood = () => {
    if (!latestImage || status === GenerationStatus.GENERATING) return;
    downloadImage(latestImage.src, latestImage.pose);
    skipToNextSequenceStep();
  };

  const handleBad = () => {
    setFeedbackSelections({ poses: false, brand: false, content: false });
    setIsFeedbackOpen(true);
  };

  const handleFeedbackRegenerate = () => {
    if (feedbackSelections.content) {
      setIsImageCalloutsMode(true);
    }
    setIsFeedbackOpen(false);
    handleGenerate();
  };

  const handleBackReferenceGenerate = async () => {
    if (!backModelImage || !backBraProductImage || (needsPantyProduct && !backPantyProductImage)) {
      setErrorMsg('Upload back mockup images before generating the Back pose.');
      return;
    }

    setIsBackReferenceModalOpen(false);
    setPendingBackAutoGenerate(false);
    setHasUsedBackReferencesInSequence(true);
    await handleGenerate({
      modelOverride: backModelImage,
      braOverride: backBraProductImage,
      pantyOverride: backPantyProductImage,
    });

    setBackModelImage(null);
    setBackBraProductImage(null);
    setBackPantyProductImage(null);
  };

  useEffect(() => {
    if (!autoGenerateTarget) return;
    if (!isCurrentSequenceStep(autoGenerateTarget)) return;
    setAutoGenerateTarget(null);
    handleGenerate();
  }, [autoGenerateTarget, viewAngle, sideViewVariant, frontViewVariant]);

  const ratios: { value: AspectRatio; label: string }[] = [
    { value: '1:1', label: 'Square' },
    { value: '3:4', label: 'Portrait' },
    { value: '9:16', label: 'Story' },
    { value: '4:3', label: 'Landscape' },
    { value: '16:9', label: 'Cinema' },
    { value: '21:9', label: 'Amazon A+' },
  ];

  const isBrandSelectionActive = needsBraProduct;
  const activeImageCalloutFields = IMAGE_CALLOUT_FIELDS.filter(({ key }) =>
    activePromptFieldKeys.includes(key)
  );
  const normalizedPresetSearch = stylePresetSearch.trim().toLowerCase();
  const visibleStylePresets = normalizedPresetSearch
    ? stylePresets.filter((preset) => {
        const name = preset.styleName.toLowerCase();
        // For pure-number searches (e.g. "35"), match as a whole number so "35" doesn't
        // appear inside "3510", "350", etc.
        if (/^\d+$/.test(normalizedPresetSearch)) {
          return new RegExp(`(^|\\D)${normalizedPresetSearch}(\\D|$)`).test(name);
        }
        return name.includes(normalizedPresetSearch);
      })
    : stylePresets;
  const selectedPresetValue = selectedPresetStyleName && selectedPresetPose
    ? `${selectedPresetStyleName}||${selectedPresetPose}`
    : '';

  const isFullCustomPromptMode =
    !isImageCalloutsMode && creativeDirection.trim().length > 150;

  return (
    <div className="dB">
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onLogin={handleLoginSuccess} />

      <div className="dB-top">
        <div className="dB-brand">
          <div className="dB-logo">S</div>
          <span className="dB-name">Studio</span>
          <span className="dB-tag">· your AI photoshoot kit</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="dB-pro">
            <span className="dB-pro-d"></span>
            {isPro ? 'Pro active' : `Free plan · ${Math.min(usageCount, 3)}/3 used`}
          </div>
          {isPro ? (
            <button type="button" className="dB-login" style={{ backgroundColor: 'transparent', color: '#ff4d4f', border: '1px solid #ff4d4f' }} onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <button type="button" className="dB-login" onClick={() => setIsLoginModalOpen(true)}>
              Login
            </button>
          )}
        </div>
      </div>

      <div className="dB-body">
        <div className="dB-left">
          <div className="dB-guide">
            <div className="dB-guide-t">Download the Smart Style guide first — it explains how to use each mode.</div>
            <a className="dB-guide-b" href="/Smart_Style_System_Layman_Guide.docx" download="Smart_Style_System_Layman_Guide.docx">
              Guide
            </a>
          </div>

          <div className="dB-greet">
            <div className="dB-q">What are we shooting?</div>
            <div className="dB-q-sub">Pick a shoot type to begin.</div>
          </div>

          <div className="dB-modes">
            <button
              className={`dB-mode${selectedMode === 'PANTY_ONLY' ? ' on' : ''}`}
              data-c="orange"
              type="button"
              onClick={() => {
                setSelectedMode('PANTY_ONLY');
                setPushupBraOnly(false);
                setBraProductImage(null);
              }}
            >
              <span className="em">◧</span>
              <span className="mn">Panty</span>
              <span className="ms">2 photos</span>
            </button>
            <button
              className={`dB-mode${selectedMode === 'BRA_AND_PANTY' ? ' on' : ''}`}
              data-c="pink"
              type="button"
              onClick={() => {
                setSelectedMode('BRA_AND_PANTY');
                setPushupBraOnly(false);
              }}
            >
              <span className="em">◩</span>
              <span className="mn">Bra + Panty</span>
              <span className="ms">3 photos</span>
            </button>
            <button
              className={`dB-mode${selectedMode === 'PUSHUP' ? ' on' : ''}`}
              data-c="violet"
              type="button"
              onClick={() => {
                setSelectedMode('PUSHUP');
                setPushupBraOnly(false);
                setViewAngle('Front');
                setFrontViewVariant('FRONT_PUSH_UP');
              }}
            >
              <span className="em">△</span>
              <span className="mn">Pushup</span>
              <span className="ms">3 photos</span>
            </button>
            <button
              className={`dB-mode${selectedMode === 'BRA_ONLY' ? ' on' : ''}`}
              data-c="cyan"
              type="button"
              onClick={() => {
                setSelectedMode('BRA_ONLY');
                setPushupBraOnly(false);
                setPantyProductImage(null);
              }}
            >
              <span className="em">◻</span>
              <span className="mn">Bra</span>
              <span className="ms">2 photos</span>
            </button>
          </div>

          {isPushupMode && (
            <label className="dB-toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <input
                type="checkbox"
                checked={pushupBraOnly}
                onChange={(event) => setPushupBraOnly(event.target.checked)}
              />
              <span>Pushup bra-only mode</span>
            </label>
          )}

          <div className="dB-card">
            <div className="dB-step">
              <div className="dB-stepn">1</div>
              <div className="dB-stept">Drop your photos</div>
              <span className="dB-step-tag">{slotAdded} / {slotTotal} added</span>
            </div>
            <div className={`dB-slots ${needsBraProduct && needsPantyProduct ? 'dB-s3' : 'dB-s2'}`}>
              <ImageUploader
                variant="compact"
                label="Model"
                hint="Required"
                image={modelImage}
                onImageUpload={setModelImage}
                onClear={() => setModelImage(null)}
              />
              {needsBraProduct && (
                <ImageUploader
                  variant="compact"
                  label={isPushupMode ? 'Pushup Bra' : 'Bra'}
                  hint="Required"
                  image={braProductImage}
                  onImageUpload={setBraProductImage}
                  onClear={() => setBraProductImage(null)}
                />
              )}
              {needsPantyProduct && (
                <ImageUploader
                  variant="compact"
                  label="Panty"
                  hint="Required"
                  image={pantyProductImage}
                  onImageUpload={setPantyProductImage}
                  onClear={() => setPantyProductImage(null)}
                />
              )}
            </div>
          </div>

          <div className="dB-card">
            <div className="dB-step">
              <div className="dB-stepn">2</div>
              <div className="dB-stept">Set the scene</div>
              <span className="dB-step-tag">camera &amp; brand</span>
            </div>
            <div className="dB-row">
              <span className="dB-row-l">Camera</span>
              <div className="dB-pills">
                {ALL_ANGLES.map((angle) => {
                  const isEnabled = allowedAngles.includes(angle);
                  const isSelected = viewAngle === angle;
                  return (
                    <button
                      key={angle}
                      type="button"
                      className={`dB-pill${isSelected ? ' on' : ''}${isEnabled ? '' : ' lk'}`}
                      onClick={() => handleManualAngleChange(angle)}
                      disabled={!isEnabled}
                    >
                      {angle}
                    </button>
                  );
                })}
              </div>
            </div>
            {isBraPantyMode && viewAngle === 'Front' && (
              <div className="dB-row">
                <span className="dB-row-l">Front</span>
                <select
                  className="dB-select"
                  value={frontViewVariant}
                  onChange={(event) => handleManualFrontVariantChange(event.target.value as FrontViewVariant)}
                  disabled={!canUseFrontPromptVariants}
                >
                  <option value="FRONT_SHOOT">Front Shoot</option>
                  <option value="FRONT_PUSH_UP">Front Push-Up</option>
                </select>
              </div>
            )}
            {viewAngle === 'Side' && (
              <div className="dB-row">
                <span className="dB-row-l">Side</span>
                <select
                  className="dB-select"
                  value={sideViewVariant}
                  onChange={(event) => handleManualSideVariantChange(event.target.value as SideViewVariant)}
                  disabled={!canUseSidePromptVariants}
                >
                  <option value="SIDE_VIEW_1">Side View 1</option>
                  <option value="SIDE_VIEW_2">Side View 2</option>
                </select>
              </div>
            )}
            <div className="dB-divider-mini">
              <div className="dB-divider-mini-l"></div>
              <span className="dB-divider-mini-t">{isBrandSelectionActive ? 'Brand · active' : 'Brand · locked (Bra + Panty / Pushup only)'}</span>
              <div className="dB-divider-mini-l"></div>
            </div>
            <div className="dB-brands">
              {BRAND_SPECIFICATIONS.map((brand) => (
                <button
                  key={brand.id}
                  type="button"
                  className={`dB-br${selectedBrand === brand.id && isBrandSelectionActive ? ' on' : ''}${isBrandSelectionActive ? '' : ' dis'}`}
                  onClick={() => setSelectedBrand(brand.id)}
                  disabled={!isBrandSelectionActive}
                >
                  <div
                    className="dB-br-d"
                    title={`${brand.label}: text ${brand.fontHex}, background ${brand.backgroundColor}`}
                    style={{
                      background: `linear-gradient(90deg, ${brand.fontHex} 0 50%, ${brand.backgroundColor} 50% 100%)`,
                      border: `1px solid ${brand.fontHex}`,
                    }}
                  ></div>
                  <span className="dB-br-n">{brand.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="dB-card">
            <div className="dB-step">
              <div className="dB-stepn">3</div>
              <div className="dB-stept">Tune the output</div>
              <span className="dB-step-tag">aspect · engine · prompts</span>
            </div>
            <div className="dB-row">
              <span className="dB-row-l">Aspect</span>
              <div className="dB-mini">
                {ratios.map((ratio) => (
                  <button
                    key={ratio.value}
                    type="button"
                    className={`dB-mp${aspectRatio === ratio.value ? ' on' : ''}`}
                    onClick={() => setAspectRatio(ratio.value)}
                  >
                    {ratio.value === '21:9' ? 'A4+' : ratio.value}
                  </button>
                ))}
              </div>
            </div>
            <div className="dB-row">
              <span className="dB-row-l">Engine</span>
              <div className="dB-mini">
                <button
                  type="button"
                  className={`dB-mp${selectedAiModel === 'gemini-3-pro-image-preview' ? ' on' : ''}`}
                  onClick={() => setSelectedAiModel('gemini-3-pro-image-preview')}
                >
                  Gemini 3 Pro
                </button>
                <button
                  type="button"
                  className={`dB-mp${selectedAiModel === 'gemini-3.1-flash-image-preview' ? ' on' : ''}`}
                  onClick={() => setSelectedAiModel('gemini-3.1-flash-image-preview')}
                >
                  3.1 Fast
                </button>
              </div>
            </div>
            <div className="dB-row">
              <span className="dB-row-l">Preset</span>
              <div className="dB-mini" style={{ flexWrap: 'nowrap' }}>
                <input
                  className="dB-input"
                  type="search"
                  value={stylePresetSearch}
                  onChange={(event) => setStylePresetSearch(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && visibleStylePresets.length > 0) {
                      const firstMatch = visibleStylePresets[0];
                      handlePresetSelect(`${firstMatch.styleName}||${firstMatch.pose}`);
                    }
                  }}
                  onBlur={() => {
                    if (stylePresetSearch && !selectedPresetStyleName && visibleStylePresets.length > 0) {
                      const firstMatch = visibleStylePresets[0];
                      handlePresetSelect(`${firstMatch.styleName}||${firstMatch.pose}`);
                    }
                  }}
                  placeholder="Search style № 3"
                />
                <select
                  className="dB-select"
                  value={selectedPresetValue}
                  disabled={visibleStylePresets.length === 0}
                  onChange={(event) => handlePresetSelect(event.target.value)}
                >
                  <option value="" disabled>
                    {stylePresets.length === 0
                      ? 'No presets'
                      : visibleStylePresets.length === 0
                        ? 'No matches'
                        : 'Select preset'}
                  </option>
                  {getPresetOptions(visibleStylePresets).map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="dB-row">
              <span className="dB-row-l">Sheet</span>
              <div className="dB-mini" style={{ flexWrap: 'nowrap' }}>
                <input
                  className="dB-input"
                  type="url"
                  value={googleSheetUrl}
                  onChange={(event) => setGoogleSheetUrl(event.target.value)}
                  placeholder="Paste Google Sheet link"
                />
                <button type="button" className="dB-mp" onClick={() => syncGoogleSheetPresets()} disabled={isSheetSyncing}>
                  {isSheetSyncing ? 'Syncing' : 'Sync'}
                </button>
                {googleSheetUrl && (
                  <button type="button" className="dB-mp" onClick={handleDisconnectGoogleSheet}>Disconnect</button>
                )}
              </div>
            </div>
            {csvImportMsg && (
              <div className={`dB-msg${csvImportMsg.includes('failed') || csvImportMsg.includes('unrecognized') || csvImportMsg.includes('No valid') ? ' err' : ' ok'}`}>
                {csvImportMsg}
              </div>
            )}

            <div className="dB-row">
              <span className="dB-row-l">Mode</span>
              {isPushupBraOnlyMode ? (
                <span className="dB-msg ok">Locked to Pushup-Bra-Only-Prompt.txt</span>
              ) : (
                <div className="dB-mini">
                  <button type="button" className={`dB-mp${!isImageCalloutsMode ? ' on' : ''}`} onClick={() => setIsImageCalloutsMode(false)}>
                    Creative
                  </button>
                  <button type="button" className={`dB-mp${isImageCalloutsMode ? ' on' : ''}`} onClick={() => setIsImageCalloutsMode(true)}>
                    Callouts
                  </button>
                </div>
              )}
            </div>
            <div className="dB-row">
              <span className="dB-row-l">Sequence</span>
              <div className="dB-mini">
                <button
                  type="button"
                  className={`dB-mp${sequenceMode === 'auto' ? ' on' : ''}`}
                  onClick={() => setSequenceMode('auto')}
                >
                  Auto
                </button>
                <button
                  type="button"
                  className={`dB-mp${sequenceMode === 'custom' ? ' on' : ''}`}
                  onClick={() => setSequenceMode('custom')}
                >
                  Custom
                </button>
                {sequenceMode === 'custom' && customSequence.length > 0 && (
                  <button type="button" className="dB-mp" onClick={() => setCustomSequence([])}>
                    Clear
                  </button>
                )}
              </div>
            </div>
            {sequenceMode === 'custom' && (
              <div className="dB-row">
                <span className="dB-row-l">Order</span>
                <div className="dB-pills">
                  {ALL_ANGLES.map((angle) => (
                    <button
                      key={angle}
                      type="button"
                      className={`dB-pill${customSequence.includes(angle) ? ' on' : ''}`}
                      onClick={() => {
                        setCustomSequence((current) =>
                          current.includes(angle)
                            ? current.filter((entry) => entry !== angle)
                            : [...current, angle]
                        );
                      }}
                    >
                      {angle}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="dB-card">
            {isPushupBraOnlyMode ? (
              <div className="dB-msg ok">
                Exact TXT prompt active. Only the selected brand specification is substituted.
              </div>
            ) : !isImageCalloutsMode ? (
              <>
                <textarea
                  className="dB-note"
                  rows={3}
                  placeholder="A short note about mood, lighting, or style (optional)…"
                  value={creativeDirection}
                  onChange={(event) => setCreativeDirection(event.target.value)}
                />
                {isFullCustomPromptMode && (
                  <div className="dB-msg">Full custom prompt detected — this replaces the structured prompt.</div>
                )}
              </>
            ) : (
              <div className="dB-callouts">
                {activeImageCalloutFields.length > 0 ? (
                  activeImageCalloutFields.map(({ key, label, placeholder, zoneKey }) => (
                    <div key={key} className="dB-callout-field">
                      <label className="dB-callout-label">{label}</label>
                      <textarea
                        className="dB-callout-input"
                        placeholder={placeholder}
                        value={imageCalloutsContent[key] as string}
                        onChange={(event) =>
                          setImageCalloutsContent((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                      />
                      {zoneKey && viewAngle !== 'Mood' && (
                        <select
                          className="dB-select"
                          value={(imageCalloutsContent[zoneKey] as CalloutZone) || 'auto'}
                          onChange={(event) =>
                            setImageCalloutsContent((current) => ({
                              ...current,
                              [zoneKey]: event.target.value as CalloutZone,
                            }))
                          }
                        >
                          {ZONE_OPTIONS.map(({ value, label: optLabel }) => (
                            <option key={value} value={value}>
                              {optLabel}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="dB-callout-empty">This pose does not use editable callout fields. Switch to Side, Back, or Mood view.</div>
                )}
              </div>
            )}
          </div>

          <div className="dB-spacer"></div>

          <button
            className={`dB-cta${!canGenerate || status === GenerationStatus.GENERATING ? ' dis' : ''}`}
            onClick={() => handleGenerate()}
            disabled={!canGenerate || status === GenerationStatus.GENERATING}
          >
            <span className="dB-cta-em">✦</span>
            <span>
              {status === GenerationStatus.GENERATING
                ? 'Generating...'
                : !isPro && usageCount >= 3
                  ? 'Unlock to generate'
                  : !canGenerate
                    ? isBraOnlyMode
                      ? 'Add model + bra to make image'
                      : needsBraProduct
                        ? `Add model + ${isPushupMode ? 'pushup bra' : 'bra'}${needsPantyProduct ? ' + panty' : ''} to make image`
                        : 'Add model + panty to make image'
                    : `Generate ${viewAngle} view`}
            </span>
          </button>

          {!isPro && (
            <div className="dB-help">{remainingGenerations} generations remaining</div>
          )}
          {status === GenerationStatus.ERROR && errorMsg && (
            <div className="dB-msg err">{errorMsg}</div>
          )}
        </div>

        <div className="dB-right">
          <div className="dB-result-h">
            <div className="dB-result-t">Your image</div>
            <span className="dB-result-tag">{displayModeLabel} · {ratioLabel}</span>
          </div>

          <div className="dB-canvas dB-canvas-corners">
            {status === GenerationStatus.GENERATING && previewPair.length === 0 ? (
              <>
                <div className="dB-canvas-tt">Generating...</div>
                <div className="dB-canvas-s">
                  Building a {viewAngle.toLowerCase()} view in {modeLabel} mode.
                </div>
                <div className="dB-canvas-chip">processing</div>
              </>
            ) : previewPair.length === 0 ? (
              <>
                <div className="dB-canvas-tt">Nothing here yet</div>
                <div className="dB-canvas-s">Add your photos on the left and tap "make image" — your shoot will appear here in about 12 seconds.</div>
                <div className="dB-canvas-chip">awaiting {awaitingCount} photos</div>
              </>
            ) : (
              <div className="dB-preview-grid">
                {[0, 1].map((slot) => {
                  const item = previewPair[slot] || null;
                  return (
                    <div key={slot} className="dB-preview-slot">
                      {item ? (
                        <>
                          <div className="dB-preview-tag">{item.pose} · {item.ratio}</div>
                          <img src={item.src} alt="Generated" className="dB-preview" />
                        </>
                      ) : (
                        <div className="dB-preview-placeholder">
                          <div>Waiting for next image</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="dB-meta-strip">
            <div className="dB-meta-it">
              <span className="dB-meta-l">Mode</span>
              <span className="dB-meta-v">{displayModeLabel}</span>
            </div>
            <div className="dB-meta-sep"></div>
            <div className="dB-meta-it">
              <span className="dB-meta-l">Brand</span>
              <span className="dB-meta-v">{isBrandSelectionActive ? activeBrand?.label : '—'}</span>
            </div>
            <div className="dB-meta-sep"></div>
            <div className="dB-meta-it">
              <span className="dB-meta-l">Pose</span>
              <span className="dB-meta-v">{poseLabel}</span>
            </div>
            <div className="dB-meta-sep"></div>
            <div className="dB-meta-it">
              <span className="dB-meta-l">Engine</span>
              <span className="dB-meta-v">{engineLabel}</span>
            </div>
          </div>

          <div className="dB-act">
            <button
              className="dB-act-b stop"
              onClick={handleStopGeneration}
              title="Stop current generation or auto sequence"
            >
              Stop
            </button>
            <button
              className="dB-act-b good"
              disabled={!latestImage || status === GenerationStatus.PREPARING || status === GenerationStatus.GENERATING}
              onClick={handleGood}
            >
              Good
            </button>
            <button
              className="dB-act-b bad"
              disabled={!latestImage || status === GenerationStatus.PREPARING || status === GenerationStatus.GENERATING}
              onClick={handleBad}
            >
              Bad
            </button>
          </div>

          <div className="dB-foot">
            Powered by Gemini Vision Model. Studio composites innerwear products onto model references.<br />Ensure you have rights to use uploaded images.
          </div>
        </div>
      </div>

      {isFeedbackOpen && (
        <div className="dB-modal" role="dialog" aria-modal="true">
          <div className="dB-modal-card">
            <div className="dB-modal-title">Did you change anything above all the panels?</div>
            <div className="dB-modal-sub">Pick what you want to adjust before regenerating.</div>
            <div className="dB-modal-options">
              {(['poses', 'brand', 'content'] as const).map((key) => (
                <label key={key} className="dB-modal-option">
                  <input
                    type="checkbox"
                    checked={feedbackSelections[key]}
                    onChange={(event) =>
                      setFeedbackSelections((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  {key === 'poses' ? 'Poses' : key === 'brand' ? 'Brand' : 'Content'}
                </label>
              ))}
            </div>

            {feedbackSelections.brand && (
              <div className="dB-feedback-brand-grid">
                {BRAND_SPECIFICATIONS.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    className={`dB-feedback-brand${selectedBrand === brand.id ? ' on' : ''}`}
                    onClick={() => setSelectedBrand(brand.id)}
                  >
                    <span className="dB-feedback-brand-dot" style={{ background: brand.fontHex }}></span>
                    <span>{brand.label}</span>
                  </button>
                ))}
              </div>
            )}

            {feedbackSelections.content && (
              <div className="dB-callouts">
                {IMAGE_CALLOUT_FIELDS.map(({ key, label, placeholder, zoneKey }) => (
                  <div key={key} className="dB-callout-field">
                    <label className="dB-callout-label">{label}</label>
                    <textarea
                      className="dB-callout-input"
                      placeholder={placeholder}
                      value={imageCalloutsContent[key] as string}
                      onChange={(event) =>
                        setImageCalloutsContent((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                    {zoneKey && viewAngle !== 'Mood' && (
                      <select
                        className="dB-select"
                        value={(imageCalloutsContent[zoneKey] as CalloutZone) || 'auto'}
                        onChange={(event) =>
                          setImageCalloutsContent((current) => ({
                            ...current,
                            [zoneKey]: event.target.value as CalloutZone,
                          }))
                        }
                      >
                        {ZONE_OPTIONS.map(({ value, label: optLabel }) => (
                          <option key={value} value={value}>
                            {optLabel}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="dB-modal-actions">
              <button type="button" className="dB-act-b" onClick={() => setIsFeedbackOpen(false)}>
                Cancel
              </button>
              <button type="button" className="dB-act-b bad" onClick={handleFeedbackRegenerate}>
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {isBackReferenceModalOpen && (
        <div className="dB-modal" role="dialog" aria-modal="true">
          <div className="dB-modal-card">
            <div className="dB-modal-title">Upload Back Pose References</div>
            <div className="dB-modal-sub">
              For the Back pose, upload back facing images for the model and bra. These are used only for this Back generation; after it finishes, Studio keeps your original front references for the next poses.
            </div>
            <div className="dB-back-ref-grid">
              <ImageUploader
                variant="compact"
                label="Model Back Image"
                hint="Back facing model"
                image={backModelImage}
                onImageUpload={setBackModelImage}
                onClear={() => setBackModelImage(null)}
              />
              <ImageUploader
                variant="compact"
                label="Bra Back Mockup"
                hint="Back view required"
                image={backBraProductImage}
                onImageUpload={setBackBraProductImage}
                onClear={() => setBackBraProductImage(null)}
              />
              {needsPantyProduct && (
                <ImageUploader
                  variant="compact"
                  label="Panty Back Mockup"
                  hint="Back view required"
                  image={backPantyProductImage}
                  onImageUpload={setBackPantyProductImage}
                  onClear={() => setBackPantyProductImage(null)}
                />
              )}
            </div>
            <div className="dB-msg">
              One-time swap: only the Back generation receives these back references. Your earlier uploaded model and bra images are restored automatically for the rest of the sequence.
            </div>
            <div className="dB-modal-actions">
              <button
                type="button"
                className="dB-act-b"
                onClick={() => {
                  setIsBackReferenceModalOpen(false);
                  setPendingBackAutoGenerate(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dB-act-b good"
                disabled={!backModelImage || !backBraProductImage || (needsPantyProduct && !backPantyProductImage) || status === GenerationStatus.PREPARING || status === GenerationStatus.GENERATING}
                onClick={handleBackReferenceGenerate}
              >
                Generate Back
              </button>
            </div>
          </div>
        </div>
      )}

      {isOptionalPoseModalOpen && (
        <div className="dB-modal" role="dialog" aria-modal="true">
          <div className="dB-modal-card">
            <div className="dB-modal-title">Optional Pose</div>
            <div className="dB-modal-sub">
              Do you want to generate the {viewAngle} image, or skip to the next pose in the sequence?
            </div>
            <div className="dB-modal-actions">
              <button
                type="button"
                className="dB-act-b bad"
                onClick={() => {
                  setIsOptionalPoseModalOpen(false);
                  setPendingOptionalGenerateParams(null);
                  skipToNextSequenceStep();
                }}
              >
                Skip Pose
              </button>
              <button
                type="button"
                className="dB-act-b good"
                onClick={() => {
                  setIsOptionalPoseModalOpen(false);
                  handleGenerate({ ...pendingOptionalGenerateParams, skipOptionalCheck: true });
                }}
              >
                Generate {viewAngle}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
