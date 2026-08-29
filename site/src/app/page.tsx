import { Hero } from "@/components/Hero";
import { MarqueeTicker } from "@/components/MarqueeTicker";
import { ProblemSection } from "@/components/ProblemSection";
import { CoreStatement } from "@/components/CoreStatement";
import { HowItWorks } from "@/components/HowItWorks";
import { AISection } from "@/components/AISection";
import { VibeCheckToy } from "@/components/VibeCheckToy";
import { ConnectionSection } from "@/components/ConnectionSection";
import { Activities } from "@/components/Activities";
import { StickerSheet } from "@/components/StickerSheet";
import { AppPreview } from "@/components/AppPreview";
import { SafetySection } from "@/components/SafetySection";
import { JapanSection } from "@/components/JapanSection";
import { FinalCTA } from "@/components/FinalCTA";
import { ScrollShowcase } from "@/components/ScrollShowcase";
import { WaveSection } from "@/components/WaveSection";

export default function Home() {
  return (
    <>
      <Hero />
      <MarqueeTicker label="Sample plans · this week" />
      <ProblemSection />
      <CoreStatement />
      <HowItWorks />
      <ScrollShowcase />
      <AISection />
      <VibeCheckToy />
      <ConnectionSection />
      <Activities />
      <StickerSheet />
      <MarqueeTicker label="More of what people gather around" />
      <AppPreview />
      <SafetySection />
      <JapanSection />
      <WaveSection />
      <FinalCTA />
    </>
  );
}
