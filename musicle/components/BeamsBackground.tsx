"use client";
import Beams from "./Beams";

const BeamsBackground = (props) => {
  return (
    <div
      className="opacity-50"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        pointerEvents: "none",
      }}
    >
      <Beams {...props} />
    </div>
  );
};

export default BeamsBackground;
