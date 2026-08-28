import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { GSAPProvider } from "@/components/GSAPProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atsumaru — Meet People Around What You Love",
  description:
    "Atsumaru brings people together in small groups around shared interests, real activities, and low-pressure connections. Not a dating app — friendship first.",
  openGraph: {
    title: "Atsumaru — Meet People Around What You Love",
    description:
      "Small groups. Shared interests. Real activities. Low-pressure connections.",
    url: "https://atsumaru.app",
    siteName: "Atsumaru",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Atsumaru — Meet People Around What You Love",
    description:
      "Small groups. Shared interests. Real activities. Low-pressure connections.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoSansJP.variable} antialiased`}
    >
      <body className="min-h-screen bg-bg text-text">
        <GSAPProvider>{children}</GSAPProvider>
      </body>
    </html>
  );
}
