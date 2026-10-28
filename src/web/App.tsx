import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/dashboard";
import MapPage from "./pages/map";

export function App() {
  return (
    <BrowserRouter>
      <nav>
        <NavLink to="/" end>Map</NavLink> <NavLink to="/dashboard">Dashboard</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
