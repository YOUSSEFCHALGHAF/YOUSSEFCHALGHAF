import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import EstablishmentDetailPage from "./pages/EstablishmentDetailPage.jsx";
import EstablishmentsPage from "./pages/EstablishmentsPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MyTicketsPage from "./pages/MyTicketsPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import TicketPage from "./pages/TicketPage.jsx";
import AdminEstablishmentsPage from "./pages/admin/AdminEstablishmentsPage.jsx";
import AdminUsersPage from "./pages/admin/AdminUsersPage.jsx";
import MerchantDashboardPage from "./pages/merchant/MerchantDashboardPage.jsx";
import QueueManagePage from "./pages/merchant/QueueManagePage.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Pages publiques */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/establishments" element={<EstablishmentsPage />} />
        <Route path="/establishments/:id" element={<EstablishmentDetailPage />} />

        {/* Tout utilisateur connecté */}
        <Route element={<ProtectedRoute />}>
          <Route path="/tickets/:id" element={<TicketPage />} />
        </Route>

        {/* Clients */}
        <Route element={<ProtectedRoute roles={["CLIENT"]} />}>
          <Route path="/my-tickets" element={<MyTicketsPage />} />
        </Route>

        {/* Commerçants (et admin) */}
        <Route element={<ProtectedRoute roles={["MERCHANT", "ADMIN"]} />}>
          <Route path="/merchant" element={<MerchantDashboardPage />} />
          <Route path="/merchant/queues/:id" element={<QueueManagePage />} />
        </Route>

        {/* Administrateur */}
        <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
          <Route path="/admin" element={<Navigate to="/admin/establishments" replace />} />
          <Route path="/admin/establishments" element={<AdminEstablishmentsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}