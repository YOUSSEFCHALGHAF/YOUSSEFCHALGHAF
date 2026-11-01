import "@testing-library/jest-dom/vitest"; // ajoute toBeInTheDocument(), toHaveTextContent()...
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();            // retire les composants affichés par le test précédent
  localStorage.clear(); // tests indépendants
});