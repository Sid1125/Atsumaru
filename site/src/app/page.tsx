import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { ProblemSection } from "@/components/ProblemSection";
import { CoreStatement } from "@/components/CoreStatement";
import { HowItWorks } from "@/components/HowItWorks";
import { AISection } from "@/components/AISection";
import { ConnectionSection } from "@/components/ConnectionSection";
import { Activities } from "@/components/Activities";
import { AppPreview } from "@/components/AppPreview";
import { SafetySection } from "@/components/SafetySection";
import { JapanSection } from "@/components/JapanSection";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";
import { ScrollShowcase } from "@/components/ScrollShowcase";
import { WaveSection } from "@/components/WaveSection";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ProblemSection />
        <CoreStatement />
        <HowItWorks />
        <ScrollShowcase />
        <AISection />
        <ConnectionSection />
        <Activities />
        <AppPreview />
        <SafetySection />
        <JapanSection />
        <WaveSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
