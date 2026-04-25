import type { Metadata } from "next";
import { DotGothic16, Space_Mono } from "next/font/google";
import "./globals.css";

const dotGothic = DotGothic16({ subsets:["latin"], weight: "400", variable: "--font-dot" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "FUISHAN | Vibe Coding MVP",
  description: "Go from idea to functional web app using natural language.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${dotGothic.variable} ${spaceMono.variable} antialiased bg-black min-h-screen`}>
        {children}
      </body>
    </html>
  );
}