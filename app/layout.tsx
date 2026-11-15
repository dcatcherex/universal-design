import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "บ้านอยู่ดี | Baan Yoo Dee",
  description: "วางแผนปรับห้องนั่งเล่นให้เหมาะกับชีวิตประจำวัน",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
