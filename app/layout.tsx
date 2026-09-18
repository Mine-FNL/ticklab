import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Ticklab',
  description: 'Research terminal for Uniswap V3 concentrated liquidity strategies',
  keywords: ['Uniswap', 'DeFi', 'LP', 'liquidity', 'yield', 'strategy', 'backtest'],
  authors: [{ name: 'Ticklab' }],
  openGraph: {
    title: 'Ticklab',
    description: 'Research terminal for Uniswap V3 concentrated liquidity strategies',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
