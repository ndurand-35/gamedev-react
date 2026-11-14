import { describe, expect, it } from "vitest";

import { ComponentType, PersonType, type Person } from "@/data/interface";
import { interviewDialogue } from "@/data/utils/interviewDialogue";

const candidate = (over: Partial<Person> = {}): Person =>
  ({
    id: 4,
    firstName: "Ada",
    lastName: "Martin",
    personType: PersonType.PROD,
    specialty: ComponentType.CODE,
    codeStat: 60,
    visualStat: 20,
    uxStat: 20,
    seniority: "junior",
    temperament: "ambitieux",
    traits: ["mentor"],
    ...over,
  }) as Person;

describe("interviewDialogue", () => {
  it("alterne fondateur et candidat, dans l'ordre de la durée", () => {
    const lines = interviewDialogue(candidate());
    expect(lines[0].speaker).toBe("founder");
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].at).toBeGreaterThan(lines[i - 1].at);
      expect(lines[i].speaker).not.toBe(lines[i - 1].speaker);
    }
    expect(lines[lines.length - 1].at).toBeLessThan(1);
  });

  it("laisse deviner le profil : séniorité, trait, tempérament", () => {
    const text = interviewDialogue(candidate())
      .filter((l) => l.speaker === "candidate")
      .map((l) => l.text)
      .join(" ");
    expect(text).toContain("Je débute dans le code");
    expect(text).toContain("transmettre"); // mentor
    expect(text).toContain("je ne descendrai pas"); // ambitieux
  });

  it("reste stable d'un rendu à l'autre", () => {
    expect(interviewDialogue(candidate())).toEqual(
      interviewDialogue(candidate()),
    );
  });
});
