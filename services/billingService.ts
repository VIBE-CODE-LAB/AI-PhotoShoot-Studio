import type { BillingModel, BillingSummary, ImageQuality } from '../types';

const USER_NAME_KEY = 'belle_user_name';
const BILLING_API_URL = import.meta.env.VITE_BILLING_API_URL || '/api';

const emptySummary = (userName = ''): BillingSummary => ({
  userName,
  totalUsd: 0,
  totalInr: 0,
  records: [],
});

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
  return postBilling('/billing/summary', { keyFingerprint, userName: userName.trim() });
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
  return postBilling('/billing/record', {
    keyFingerprint,
    userName: userName.trim(),
    model,
    quality,
  });
};