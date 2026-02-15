'use client';

import React from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

export function Providers({ children }: { children: React.ReactNode }) {
  const manifestUrl = process.env.NEXT_PUBLIC_TONCONNECT_MANIFEST_URL!;
  return <TonConnectUIProvider manifestUrl={manifestUrl}>{children}</TonConnectUIProvider>;
}
