import React, { useState } from 'react';
import { Button } from './Button';
import { setStoredApiKey } from '../services/geminiService';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== 'Studio@5678') {
      setError('Invalid access code. Please try again.');
      return;
    }

    const trimmedKey = apiKey.trim();
    if (!trimmedKey || !trimmedKey.startsWith('AIza')) {
      setError('Please enter a valid Gemini API key (starts with "AIza").');
      return;
    }

    setStoredApiKey(trimmedKey);
    onLogin();
  };

  const EyeIcon = ({ visible }: { visible: boolean }) => visible ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7c.44 0 .87-.022 1.28-.07"/><line x1="2" x2="22" y1="2" y2="22"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-brand-100 flex justify-between items-center bg-brand-50">
          <h3 className="text-xl font-serif font-semibold text-brand-900">Unlock PhotoShoot Studio</h3>
          <button onClick={onClose} className="text-brand-400 hover:text-brand-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h4 className="text-lg font-medium text-brand-900">Access Required</h4>
            <p className="text-brand-600 text-sm mt-1">Enter your access code and your personal Gemini API key to continue. Your key is stored only in your browser.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Access Password */}
            <div>
              <label className="block text-sm font-medium text-brand-800 mb-1">Access Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white text-brand-900 placeholder-brand-400 border border-brand-200 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                  placeholder="Enter access password..."
                  autoFocus
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-600 focus:outline-none">
                  <EyeIcon visible={showPassword} />
                </button>
              </div>
            </div>

            {/* Gemini API Key */}
            <div>
              <label className="block text-sm font-medium text-brand-800 mb-1">
                Gemini API Key
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                  className="ml-2 text-xs text-brand-500 underline hover:text-brand-700">Get a free key →</a>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-white text-brand-900 placeholder-brand-400 border border-brand-200 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-brand-500 outline-none transition-all font-mono text-sm"
                  placeholder="AIzaSy..."
                />
                <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-600 focus:outline-none">
                  <EyeIcon visible={showApiKey} />
                </button>
              </div>
              <p className="text-xs text-brand-400 mt-1">Your key is stored only in your browser — never sent to any server.</p>
            </div>

            {error && (
              <p className="text-red-500 text-sm flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
                </svg>
                {error}
              </p>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
              <Button type="submit" className="w-full sm:w-auto">Unlock Access</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};