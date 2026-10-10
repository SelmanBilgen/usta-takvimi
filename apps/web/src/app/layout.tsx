import "./globals.css";

import type { Metadata, Viewport } from "next";

import { InstallPwaButton } from "../components/install-pwa-button";
import { PwaRegister } from "../components/pwa-register";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "UstaTakvimi",
  description: "Insaat sirketleri icin is gucu takvimi ve talep yonetimi",
  applicationName: "UstaTakvimi",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "UstaTakvimi",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
  colorScheme: "light"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <PwaRegister />
        <InstallPwaButton />
        {children}
      </body>
    </html>
  );
}
