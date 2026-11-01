import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./api.js";

describe("getErrorMessage", () => {
  it("renvoie le message métier de FastAPI", () => {
    const error = { response: { status: 409, data: { detail: "La file est fermée" } } };
    expect(getErrorMessage(error)).toBe("La file est fermée");
  });

  it("assemble les erreurs de validation 422", () => {
    const error = { response: { status: 422, data: { detail: [
      { msg: "Value error, Le mot de passe doit contenir au moins une lettre et un chiffre" },
      { msg: "Field required" },
    ] } } };
    expect(getErrorMessage(error)).toBe(
      "Le mot de passe doit contenir au moins une lettre et un chiffre · Field required"
    );
  });

  it("donne le code HTTP s’il n’y a pas de détail", () => {
    expect(getErrorMessage({ response: { status: 500, data: {} } })).toBe("Erreur 500");
  });

  it("signale un serveur injoignable", () => {
    expect(getErrorMessage({ request: {} })).toBe("Le serveur ne répond pas");
  });

  it("gère une erreur inattendue", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("Erreur inattendue");
  });
});