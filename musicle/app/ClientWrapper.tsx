"use client";

import { usePathname } from "next/navigation";
import React from "react";
import BeamsBackground from "@/components/BeamsBackground";
import { Chatbot } from "@/components/Chatbot";
const ClientWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();

  const beamScale = pathname === "/sketchbook" || pathname === "/feed" ? 0.0 : 0.3;
  const rotation = pathname === "/sketchbook" || pathname === "/feed" ? 190 : 30;
  const lightColor = pathname === "/sketchbook" || pathname === "/feed" ? "#000000" : "#edd9ff";

  return (
    <>
      <BeamsBackground
        beamWidth={4}
        beamHeight={25}
        beamNumber={20}
        lightColor={lightColor}
        speed={4}
        noiseIntensity={5}
        scale={beamScale}
        rotation={rotation}
      />
      <Chatbot />
      {children}
    </>
  );
};

export default ClientWrapper;
