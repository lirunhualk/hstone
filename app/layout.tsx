import type { Metadata } from "next";
import "./game.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "经典酒馆战棋 · 单机版",
    template: "%s · 经典酒馆战棋",
  },
  description:
    "一名玩家与七名 AI 对战、没有回合倒计时的本地经典酒馆战棋。",
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
