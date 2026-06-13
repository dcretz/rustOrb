import { useCallback, useState } from "react";
import Header from "./components/header";
import PlasmaOrb from "./components/PlasmaOrb";
import SmartMenu from "./components/SmartMenu";
import JarvisWidget from "./components/JarvisWidget";
import "./App.css";

type RGB = [number, number, number];

const JARVIS_COLORS: Record<string, RGB> = {
  idle:      [0.10, 0.75, 0.80], // cyan (default)
  listening: [0.10, 0.82, 0.28], // green
  thinking:  [0.58, 0.12, 0.90], // violet
  speaking:  [0.05, 0.82, 0.92], // bright cyan
};

function App() {
  const [orbColor, setOrbColor] = useState<RGB>(JARVIS_COLORS.idle);

  const handleJarvisState = useCallback((state: string) => {
    const c = JARVIS_COLORS[state];
    if (c) setOrbColor(c);
  }, []);

  return (
    <>
      <Header />
      <PlasmaOrb color={orbColor} />
      <SmartMenu onColorChange={setOrbColor} />
      <JarvisWidget onStateChange={handleJarvisState} />
      <main className="container">
      </main>
    </>
  );
}

export default App;
