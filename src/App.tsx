import { useState } from "react";
import Header from "./components/header";
import PlasmaOrb from "./components/PlasmaOrb";
import SmartMenu from "./components/SmartMenu";
import "./App.css";

type RGB = [number, number, number];

function App() {
  // orb hue, controlled by the menu selection (default cyan / "Find my")
  const [orbColor, setOrbColor] = useState<RGB>([0.10, 0.75, 0.80]);

  return (
    <>
      <Header />
      <PlasmaOrb color={orbColor} />
      <SmartMenu onColorChange={setOrbColor} />
      <main className="container">
      </main>
    </>
  );
}

export default App;
