import { useState } from "react";
import ZombieSurvivalGame from "./ZombieSurvivalGame";

export default function ZombieDemo() {
  const [apples, setApples] = useState(9999);

  return (
    <main style={{
      minHeight: "100vh",
      padding: "18px",
      background: "linear-gradient(180deg, #101615, #0a0f0d 62%, #060807)",
    }}>
      <ZombieSurvivalGame
        demo
        token="demo"
        apples={apples}
        onApplesChange={setApples}
      />
    </main>
  );
}
