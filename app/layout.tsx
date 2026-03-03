import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New, Montserrat } from "next/font/google";
import "./globals.css";

const zenKaku = Zen_Kaku_Gothic_New({
  variable: "--font-zen-kaku",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "OVERworks",
  description: "OVER Inc. 統合ワークツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${zenKaku.variable} ${montserrat.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
