import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { GSAPProvider } from "@/components/GSAPProvider";
import { Preloader } from "@/components/Preloader";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { WaitlistModal } from "@/components/WaitlistModal";

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
      {/* Browser extensions (Grammarly and friends) add attributes to <body> before
          React hydrates, which otherwise logs a hydration mismatch we cannot fix. */}
      <body
        suppressHydrationWarning
        className="min-h-screen bg-bg text-text selection:bg-accent-light selection:text-accent"
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[400] focus:rounded-xl focus:bg-white focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-text shadow-xl"
        >
          Skip to content
        </a>
        <GSAPProvider>
          <Preloader />
          <Navbar />
          <main id="main-content">{children}</main>
          <Footer />
          <WaitlistModal />
        </GSAPProvider>
      </body>
    </html>
  );
}

