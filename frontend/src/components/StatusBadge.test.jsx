import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusBadge from "./StatusBadge.jsx";

describe("StatusBadge", () => {
  it.each([
    ["WAITING", "En attente"],
    ["CALLED", "Appelé"],
    ["SERVED", "Servi"],
    ["NO_SHOW", "Absent"],
    ["CANCELLED", "Annulé"],
  ])("affiche %s en français", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("affiche la valeur brute d’un statut inconnu", () => {
    render(<StatusBadge status="BIZARRE" />);
    expect(screen.getByText("BIZARRE")).toBeInTheDocument();
  });
});