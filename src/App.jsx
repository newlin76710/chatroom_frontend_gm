import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChatApp from "./features/chat/ChatApp";
import Login from "./features/auth/Login";

const PusherDemo = lazy(() => import("./features/casino/PusherDemo"));
const ZombieDemo = lazy(() => import("./features/casino/ZombieDemo"));
const LoungeDemo = lazy(() => import("./features/lounge/LoungeDemo"));
const MarqueeDemo = lazy(() => import("./features/games/MarqueeDemo"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/chat" element={<ChatApp />} />
        <Route path="/pusher-demo" element={<Suspense fallback={null}><PusherDemo /></Suspense>} />
        <Route path="/zombie-demo" element={<Suspense fallback={null}><ZombieDemo /></Suspense>} />
        <Route path="/lounge-demo" element={<Suspense fallback={null}><LoungeDemo /></Suspense>} />
        <Route path="/marquee-demo" element={<Suspense fallback={null}><MarqueeDemo /></Suspense>} />
      </Routes>
    </BrowserRouter>
  );
}
