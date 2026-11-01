import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute.jsx";

// Faux contexte d'authentification, modifiable dans chaque test
const { mockAuth } = vi.hoisted(() => ({ mockAuth: { user: null, loading: false } }));
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => mockAuth }));

function renderAdminPage() {
  render(
    <MemoryRouter initialEntries={["/admin/users"]}>
      <Routes>
        <Route path="/login" element={<p>Page de connexion</p>} />
        <Route path="/establishments" element={<p>Accueil client</p>} />
        <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
          <Route path="/admin/users" element={<p>Zone admin</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockAuth.user = null;
  mockAuth.loading = false;
});

describe("ProtectedRoute", () => {
  it("redirige un visiteur vers la connexion", () => {
    renderAdminPage();
    expect(screen.getByText("Page de connexion")).toBeInTheDocument();
  });

  it("redirige un client vers son accueil", () => {
    mockAuth.user = { role: "CLIENT" };
    renderAdminPage();
    expect(screen.getByText("Accueil client")).toBeInTheDocument();
    expect(screen.queryByText("Zone admin")).not.toBeInTheDocument();
  });

  it("affiche la page à un administrateur", () => {
    mockAuth.user = { role: "ADMIN" };
    renderAdminPage();
    expect(screen.getByText("Zone admin")).toBeInTheDocument();
  });

  it("attend la vérification de la session avant de décider", () => {
    mockAuth.loading = true;
    renderAdminPage();
    expect(screen.getByText(/Vérification de la session/)).toBeInTheDocument();
  });
});