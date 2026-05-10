import Silk from "./Silk";

const SilkBackground = ({ speed, scale, color, noiseIntensity, rotation }) => {
  return (
    <div className="fixed -z-50 opacity-100" style={{ width: "100%", height: "100%" }}>
      <Silk speed={speed} scale={scale} color={color} noiseIntensity={noiseIntensity} rotation={rotation} />
    </div>
  );
};

export default SilkBackground;
