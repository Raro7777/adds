import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "광고채널 성과 대시보드",
  description: "광고채널별·영업팀별 성과 대시보드 v6.3",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
