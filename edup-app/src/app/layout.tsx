import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "えでゅ - 知育アプリプラットフォーム",
  description: "親子で楽しむ知育アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
