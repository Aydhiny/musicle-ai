import type { Metadata } from "next";
import "./globals.css";
import { StickyBanner } from "@/components/ui/sticky-banner";
import { Navbar } from "@/components/Navbar";
import { SketchbookProvider } from "@/context/SketchbookContext";
import { AuthProvider } from "@/context/AuthContext";
import ClientWrapper from "./ClientWrapper";

export const metadata: Metadata = {
  title: "Musicle App",
  description: "Musicle is a detection software which incorporated an AI Agent to detect music styles, BPM, gives realtime tips, etc.",
  icons: {
    icon: "https://png.pngtree.com/png-vector/20241203/ourmid/pngtree-vibrant-holographic-music-note-floating-against-a-transparent-background-generative-ai-png-image_13643529.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <main className="relative min-h-screen text-white overflow-hidden font-sans selection:bg-[#BCAAF9] selection:text-black">
          <AuthProvider>
            <SketchbookProvider>
              <ClientWrapper>
                <StickyBanner className="bg-white/10 backdrop-blur-sm border-b border-white/20">
                  <p className="mx-0 max-w-[50%] text-white drop-shadow-md">
                    Newest Musicle Update set to release 23rd February 2026.{" "}
                    <a href="#" className="transition duration-200 hover:underline">
                      Read announcement
                    </a>
                  </p>
                </StickyBanner>

                <div className="relative z-10">
                  <Navbar />
                  {children}
                </div>
              </ClientWrapper>
            </SketchbookProvider>
          </AuthProvider>
        </main>
      </body>
    </html>
  );
}