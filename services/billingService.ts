import type { BillingCalculation, BillingSummary, ImageQuality, UsageMetadata } from '../types';

const USER_NAME_KEY = 'belle_user_name';
const BILLING_API_URL = (import.meta.env.VITE_BILLING_API_URL || '/api').replace(/\/$/, '');
const LOCAL_BILLING_PREFIX = 'belle_local_billing_';
const USD_TO_INR = 87.5;
const MARKUP_MULTIPLIER = 1.25;

const emptySummary = (userName = ''): BillingSummary => ({
  userName,
  totalUsd: 0,
  totalInr: 0,
  records: [],
  users: userName ? [{ userName, totalUsd: 0, totalInr: 0 }] : [],
});

const readLocalSummary = (keyFingerprint: string, userName: string): BillingSummary => {
  const raw = localStorage.getItem(`${LOCAL_BILLING_PREFIX}${keyFingerprint}`);
  if (!raw) return { ...emptySummary(userName), source: 'local' };
  try {
    return { ...JSON.parse(raw), userName, source: 'local' } as BillingSummary;
  } catch {
    return { ...emptySummary(userName), source: 'local' };
  }
};

const writeLocalSummary = (keyFingerprint: string, summary: BillingSummary): BillingSummary => {
  const localSummary = { ...summary, source: 'local' as const };
  localStorage.setItem(`${LOCAL_BILLING_PREFIX}${keyFingerprint}`, JSON.stringify(localSummary));
  return localSummary;
};

export const getStoredUserName = (): string => localStorage.getItem(USER_NAME_KEY) || '';

export const setStoredUserName = (name: string): void => {
  localStorage.setItem(USER_NAME_KEY, name.trim());
};

export const clearStoredUserName = (): void => localStorage.removeItem(USER_NAME_KEY);

export const getApiKeyFingerprint = async (apiKey: string): Promise<string> => {
  const bytes = new TextEncoder().encode(apiKey.trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const postBilling = async (path: string, payload: Record<string, unknown>): Promise<BillingSummary> => {
  const endpoints = BILLING_API_URL === '/api'
    ? [`/api${path}`, path]
    : [`${BILLING_API_URL}${path}`];
  let lastError = 'Billing service unavailable.';
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) return response.json() as Promise<BillingSummary>;
      lastError = `Billing service returned ${response.status}.`;
    } catch (error: any) {
      lastError = error.message || lastError;
    }
  }
  throw new Error(lastError);
};

export const fetchBillingSummary = async (apiKey: string, userName: string): Promise<BillingSummary> => {
  if (!apiKey || !userName.trim()) return emptySummary(userName);
  const keyFingerprint = await getApiKeyFingerprint(apiKey);
  try {
    return { ...(await postBilling('/billing/summary', { keyFingerprint, userName: userName.trim() })), source: 'server' };
  } catch {
    return readLocalSummary(keyFingerprint, userName.trim());
  }
};

export const recordGenerationCost = async ({
  apiKey,
  userName,
  model,
  quality,
  usageMetadata,
}: {
  apiKey: string;
  userName: string;
  model: string;
  quality: ImageQuality;
  usageMetadata: UsageMetadata;
}): Promise<BillingSummary> => {
  const keyFingerprint = await getApiKeyFingerprint(apiKey);
  try {
    return { ...(await postBilling('/billing/record', {
      keyFingerprint,
      userName: userName.trim(),
      model,
      quality,
      usage_metadata: usageMetadata,
      model_used: model,
    })), source: 'server' };
  } catch {
    const current = readLocalSummary(keyFingerprint, userName.trim());
    const calculation = calculateBilling({ model_used: model, usage_metadata: usageMetadata });
    const costUsd = calculation.calculation_breakdown.calculated_usd_cost;
    const costInr = calculation.final_user_billing_inr;
    return writeLocalSummary(keyFingerprint, {
      userName: userName.trim(),
      totalUsd: current.totalUsd + costUsd,
      totalInr: Number((current.totalInr + costInr).toFixed(2)),
      users: [{
        userName: userName.trim(),
        totalUsd: current.totalUsd + costUsd,
        totalInr: Number((current.totalInr + costInr).toFixed(2)),
      }],
      records: [{
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        userName: userName.trim(),
        model,
        quality,
        rawInputTokens: usageMetadata.prompt_token_count,
        rawOutputTokens: usageMetadata.candidates_token_count,
        costUsd,
        costInr: calculation.calculation_breakdown.calculated_base_inr_cost,
        finalUserBillingInr: costInr,
      }, ...current.records].slice(0, 100),
    });
  }
};

export const calculateBilling = (payload: {
  model_used: string;
  usage_metadata: UsageMetadata;
}): BillingCalculation => {
  const { model_used: model, usage_metadata: usage } = payload;
  if (!model || !usage || ![usage.prompt_token_count, usage.candidates_token_count, usage.total_token_count].every((count) => Number.isInteger(count) && count > 0)) {
    throw new Error('Missing vital token metadata');
  }
  const isFlash = /gemini-(?:2\.5|1\.5|3(?:\.1)?)-flash/i.test(model);
  const isPro = /gemini-(?:2\.5|1\.5|3(?:\.1)?)-pro/i.test(model);
  if (!isFlash && !isPro) throw new Error('Unsupported Gemini billing model');
  const inputRate = isFlash ? 0.075 : 1.25;
  const outputRate = isFlash ? 0.3 : 5;
  const usd = usage.prompt_token_count * inputRate / 1_000_000 + usage.candidates_token_count * outputRate / 1_000_000;
  const baseInr = usd * USD_TO_INR;
  return {
    status: 'success',
    calculation_breakdown: {
      model,
      raw_input_tokens: usage.prompt_token_count,
      raw_output_tokens: usage.candidates_token_count,
      calculated_usd_cost: Number(usd.toFixed(6)),
      calculated_base_inr_cost: Number(baseInr.toFixed(4)),
    },
    final_user_billing_inr: Number((baseInr * MARKUP_MULTIPLIER).toFixed(2)),
  };
};