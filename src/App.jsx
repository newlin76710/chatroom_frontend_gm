import { BrowserRouter, Routes, Route } from "react-router-dom";
import ChatApp from "./features/chat/ChatApp";
import Login from "./features/auth/Login";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/chat" element={<ChatApp />} />
      </Routes>
    </BrowserRouter>
  );
}
