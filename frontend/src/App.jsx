import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* Étape 5 : /login, /register, /establishments, /tickets/:id, /merchant, /admin */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}