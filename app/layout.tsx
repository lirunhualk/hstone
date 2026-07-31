import type { Metadata } from "next";
import "./game.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "酒馆战棋 · 单机版",
    template: "%s · 酒馆战棋单机版",
  },
  description:
    "一名玩家与七名 AI 对战、使用 36.0.3 当前随从池且没有回合倒计时的本地酒馆战棋。",
  icons: {
    icon: "/ui/battle-crossed-weapons.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
