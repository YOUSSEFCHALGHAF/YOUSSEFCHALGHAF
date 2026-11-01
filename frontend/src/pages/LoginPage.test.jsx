import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage.jsx";

const { mockLogin } = vi.hoisted(() => ({ mockLogin: vi.fn() }));
vi.mock("../context/AuthContext.jsx", () => ({ useAuth: () => ({ user: null, login: mockLogin }) }));

async function fillAndSubmit(email, password) {
  const user = userEvent.setup();
  render(<MemoryRouter><LoginPage /></MemoryRouter>);
  await user.type(screen.getByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Mot de passe"), password);
  await user.click(screen.getByRole("button", { name: "Se connecter" }));
}

beforeEach(() => mockLogin.mockReset());

describe("LoginPage", () => {
  it("transmet l’e-mail et le mot de passe saisis", async () => {
    mockLogin.mockResolvedValue({ role: "CLIENT" });
    await fillAndSubmit("client@example.com", "Demo2026!");
    expect(mockLogin).toHaveBeenCalledWith("client@example.com", "Demo2026!");
  });

  it("affiche le message d’erreur de l’API et réactive le bouton", async () => {
    mockLogin.mockRejectedValue({ response: { status: 401, data: { detail: "E-mail ou mot de passe incorrect" } } });
    await fillAndSubmit("client@example.com", "mauvais");
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou mot de passe incorrect");
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeEnabled();
  });
});