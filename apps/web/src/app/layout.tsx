import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UstaTakvimi",
  description: "Insaat sirketleri icin is gucu takvimi ve talep yonetimi"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
