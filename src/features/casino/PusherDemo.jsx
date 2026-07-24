import { useState } from "react";
import PusherMachine from "./PusherMachine";

export default function PusherDemo() {
  const [apples, setApples] = useState(300);

  return (
    <main style={{
      minHeight: "100vh",
      padding: "18px",
      background: "linear-gradient(180deg, #111817, #24120b 62%, #080706)",
    }}>
      <PusherMachine
        demo
        token="demo"
        apples={apples}
        onApplesChange={setApples}
      />
    </main>
  );
}
