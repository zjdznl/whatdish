import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import PlausibleProvider from "next-plausible";

const inter = Inter({ subsets: ["latin"] });
const title = "啥菜 WhatDish — 拍一下就知道";
const description = "拍下外文菜单，每道菜自动翻译成中文，匹配真实图片，标注中国胃适配度。";
const sitename = "啥菜";

export const metadata: Metadata = {
  title,
  description,
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title,
    description,
    siteName: sitename,
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <PlausibleProvider domain="picmenu.co" />
      </head>
      <body
        className={`${inter.className} flex flex-col min-h-screen bg-white text-gray-800`}
      >
        <Header />
        <main className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
