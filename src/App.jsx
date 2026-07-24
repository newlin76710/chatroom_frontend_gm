import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChatApp from "./features/chat/ChatApp";
import Login from "./features/auth/Login";

const PusherDemo = lazy(() => import("./features/casino/PusherDemo"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/chat" element={<ChatApp />} />
        <Route path="/pusher-demo" element={<Suspense fallback={null}><PusherDemo /></Suspense>} />
      </Routes>
    </BrowserRouter>
  );
}
