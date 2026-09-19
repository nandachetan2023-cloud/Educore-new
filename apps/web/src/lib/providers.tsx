'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, tokenStore } from './api';
import type { Branding, Me } from './types';

// ── Branding: fetch once, paint theme via CSS variables ──
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const BrandingCtx = createContext<Branding | null>(null);
export const useBranding = () => useContext(BrandingCtx);

const AuthCtx = createContext<{
  user: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
}>({ user: null, loading: true, refresh: async () => {}, logout: () => {} });
export const useAuth = () => useContext(AuthCtx);

export function Providers({
  branding: initial,
  children,
}: {
  branding: Branding;
  children: React.ReactNode;
}) {
  const [branding] = useState<Branding>(initial);
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // Apply brand colors to the document.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', hexToRgb(branding.primaryColor));
    root.style.setProperty('--brand-secondary', hexToRgb(branding.secondaryColor));
  }, [branding]);

  const refresh = useCallback(async () => {
    if (!tokenStore.access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<Me>('/auth/me'));
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <BrandingCtx.Provider value={branding}>
      <AuthCtx.Provider value={{ user, loading, refresh, logout }}>{children}</AuthCtx.Provider>
    </BrandingCtx.Provider>
  );
}
