import type { Metadata } from "next";
import "./game.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "星港战阵",
    template: "%s · 星港战阵",
  },
  description: "无需联网、没有倒计时，由你掌控回合节奏的八人自动战棋。",
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
