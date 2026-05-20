import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FireGuard QR Dashboard",
  description: "แดชบอร์ดติดตามการตรวจสอบถังดับเพลิง"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
