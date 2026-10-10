import type { Metadata } from "next";
import { Anton, Barlow_Condensed, Figtree } from "next/font/google";
import "./globals.css";

const anton = Anton({
  variable: "--font-brand",
  weight: "400",
  subsets: ["latin"],
});

const barlow = Barlow_Condensed({
  variable: "--font-score",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const figtree = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MatchMind AI",
  description:
    "AI-powered live football intelligence — synthetic events, explainable insights, personality-driven commentary.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${barlow.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
