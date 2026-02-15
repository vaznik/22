import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Casino Rooms',
  description: 'Telegram Mini App',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="bg" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
