import type { BillingModel, BillingSummary, ImageQuality } from '../types';

const USER_NAME_KEY = 'belle_user_name';
const BILLING_API_URL = (import.meta.env.VITE_BILLING_API_URL || '/api').replace(/\/$/, '');
const LOCAL_BILLING_PREFIX = 'belle_local_billing_';
const USD_TO_INR = 85;
const LOCAL_RATES: Record<BillingModel, Record<ImageQuality, number>> = {
  'gemini-3-pro-image-preview': { '1K': 0.134, '2K': 0.134 },
  'gemini-3.1-flash-image-preview': { '1K': 0.039, '2K': 0.039 },
};

const emptySummary = (userName = ''): BillingSummary => ({
  userName,
  totalUsd: 0,
  totalInr: 0,
  records: [],
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
  const response = await fetch(`${BILLING_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Billing service returned ${response.status}.`);
  return response.json() as Promise<BillingSummary>;
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
}: {
  apiKey: string;
  userName: string;
  model: BillingModel;
  quality: ImageQuality;
}): Promise<BillingSummary> => {
  const keyFingerprint = await getApiKeyFingerprint(apiKey);
  try {
    return { ...(await postBilling('/billing/record', {
      keyFingerprint,
      userName: userName.trim(),
      model,
      quality,
    })), source: 'server' };
  } catch {
    const current = readLocalSummary(keyFingerprint, userName.trim());
    const costUsd = LOCAL_RATES[model][quality];
    const costInr = Number((costUsd * USD_TO_INR).toFixed(2));
    return writeLocalSummary(keyFingerprint, {
      userName: userName.trim(),
      totalUsd: current.totalUsd + costUsd,
      totalInr: Number((current.totalInr + costInr).toFixed(2)),
      records: [{
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        model,
        quality,
        costUsd,
        costInr,
      }, ...current.records].slice(0, 100),
    });
  }
};