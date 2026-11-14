import { describe, it, expect } from "vitest";

import {
  DEFAULT_KEY_BINDINGS,
  KEY_ACTIONS,
  actionForCode,
  assignKey,
  keyLabel,
  parseKeyBindings,
} from "@/data/settings/keybindings";

const allCodes = (b: typeof DEFAULT_KEY_BINDINGS) =>
  Object.values(b)
    .flat()
    .filter((c): c is string => c !== null);

describe("touches par défaut", () => {
  it("couvrent chaque action, sans doublon ni touche réservée", () => {
    for (const { id } of KEY_ACTIONS) {
      expect(DEFAULT_KEY_BINDINGS[id][0]).not.toBeNull();
    }
    const codes = allCodes(DEFAULT_KEY_BINDINGS);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).not.toContain("Escape");
  });

  it("retrouvent l'action d'une touche, emplacement secondaire compris", () => {
    expect(actionForCode(DEFAULT_KEY_BINDINGS, "Digit2")).toBe("speed2");
    expect(actionForCode(DEFAULT_KEY_BINDINGS, "Numpad2")).toBe("speed2");
    expect(actionForCode(DEFAULT_KEY_BINDINGS, "KeyZ")).toBeNull();
  });
});

describe("assignKey", () => {
  it("affecte une touche libre", () => {
    const { bindings, displaced } = assignKey(
      DEFAULT_KEY_BINDINGS,
      "togglePause",
      1,
      "KeyK",
    );
    expect(bindings.togglePause).toEqual(["Space", "KeyK"]);
    expect(displaced).toBeNull();
    // Pas de mutation de l'original.
    expect(DEFAULT_KEY_BINDINGS.togglePause).toEqual(["Space", null]);
  });

  it("retire une touche déjà prise de son ancienne action", () => {
    const { bindings, displaced } = assignKey(
      DEFAULT_KEY_BINDINGS,
      "togglePause",
      0,
      "KeyE",
    );
    expect(bindings.togglePause[0]).toBe("KeyE");
    expect(bindings.navProduction).toEqual([null, null]);
    expect(displaced).toBe("navProduction");
    const codes = allCodes(bindings);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("déplace une touche d'un emplacement à l'autre de la même action", () => {
    const { bindings, displaced } = assignKey(
      DEFAULT_KEY_BINDINGS,
      "speed1",
      0,
      "Numpad1",
    );
    expect(bindings.speed1).toEqual(["Numpad1", null]);
    expect(displaced).toBeNull();
  });

  it("vide un emplacement, refuse une touche réservée", () => {
    expect(assignKey(DEFAULT_KEY_BINDINGS, "speed1", 1, null).bindings.speed1).toEqual([
      "Digit1",
      null,
    ]);
    const refused = assignKey(DEFAULT_KEY_BINDINGS, "speed1", 0, "Escape");
    expect(refused.bindings).toBe(DEFAULT_KEY_BINDINGS);
  });
});

describe("parseKeyBindings", () => {
  it("retombe sur les défauts si le stockage est absent ou illisible", () => {
    expect(parseKeyBindings(null)).toEqual(DEFAULT_KEY_BINDINGS);
    expect(parseKeyBindings("pas du json")).toEqual(DEFAULT_KEY_BINDINGS);
    expect(parseKeyBindings('{"speed1":"Digit1"}')).toEqual(DEFAULT_KEY_BINDINGS);
  });

  it("garde les affectations du joueur et complète les actions manquantes", () => {
    const parsed = parseKeyBindings(
      JSON.stringify({ togglePause: ["KeyE", null] }),
    );
    expect(parsed.togglePause).toEqual(["KeyE", null]);
    // Le défaut de navProduction (KeyE) ne doit pas doublonner.
    expect(parsed.navProduction).toEqual([null, null]);
    expect(parsed.speed3).toEqual(["Digit3", "Numpad3"]);
  });

  it("écarte doublons et touches réservées d'un stockage bricolé", () => {
    const parsed = parseKeyBindings(
      JSON.stringify({ speed1: ["KeyK", "Escape"], speed2: ["KeyK", null] }),
    );
    expect(parsed.speed1).toEqual(["KeyK", null]);
    expect(parsed.speed2).toEqual([null, null]);
  });
});

describe("keyLabel", () => {
  it("nomme les touches spéciales et le pavé numérique", () => {
    expect(keyLabel("Space")).toBe("Espace");
    expect(keyLabel("Numpad3")).toBe("Pavé 3");
    expect(keyLabel("Digit1")).toBe("1");
  });

  it("suit la disposition du clavier quand elle est connue", () => {
    expect(keyLabel("KeyQ")).toBe("Q");
    expect(keyLabel("KeyQ", new Map([["KeyQ", "a"]]))).toBe("A");
    // Rangée des chiffres en AZERTY : le chiffre, pas « & ».
    expect(keyLabel("Digit1", new Map([["Digit1", "&"]]))).toBe("1");
  });
});
