import { describe, expect, it } from "vitest";

import {
  ComponentType,
  PersonType,
  ProductionPerson,
  QA,
} from "@/data/interface";
import { PRODUCTION_THRESHOLD } from "@/data/redux/componentSlice";
import { employeTaskProgress } from "@/data/utils/taskProgress";

const makeDev = (over: Partial<ProductionPerson> = {}): ProductionPerson => ({
  id: 1,
  sex: "M",
  firstName: "Dev",
  lastName: "Test",
  salary: 3000,
  personType: PersonType.PROD,
  morale: 100,
  buildingId: 1,
  specialty: ComponentType.CODE,
  codeStat: 200,
  codeMaxStat: 200,
  visualStat: 50,
  visualMaxStat: 50,
  uxStat: 50,
  uxMaxStat: 50,
  assignedComponentType: ComponentType.CODE,
  ...over,
});

describe("employeTaskProgress", () => {
  it("ramène les points de production à un ratio 0..1", () => {
    const dev = makeDev();
    expect(
      employeTaskProgress(dev, { [dev.id]: PRODUCTION_THRESHOLD / 4 }),
    ).toBeCloseTo(0.25);
  });

  it("part de zéro quand l'employé affecté n'a pas encore de points", () => {
    expect(employeTaskProgress(makeDev(), {})).toBe(0);
  });

  it("borne le ratio à 1 sur un compteur au-delà du seuil", () => {
    const dev = makeDev();
    expect(
      employeTaskProgress(dev, { [dev.id]: PRODUCTION_THRESHOLD + 50 }),
    ).toBe(1);
  });

  it("suit la progression de formation vers le prochain point", () => {
    const dev = makeDev({
      assignedComponentType: null,
      trainingType: ComponentType.VISUEL,
      trainingProgress: 4,
    });
    expect(employeTaskProgress(dev, {})).toBeCloseTo(0.4);
  });

  it("la production passe devant la formation si les deux sont posées", () => {
    const dev = makeDev({
      trainingType: ComponentType.VISUEL,
      trainingProgress: 9,
    });
    expect(
      employeTaskProgress(dev, { [dev.id]: PRODUCTION_THRESHOLD / 10 }),
    ).toBeCloseTo(0.1);
  });

  it("renvoie null pour un employé de production inactif, même avec un reliquat", () => {
    const dev = makeDev({ assignedComponentType: null });
    expect(employeTaskProgress(dev, { [dev.id]: 3000 })).toBeNull();
  });

  it("renvoie null pour un rôle sans tâche produisible (QA)", () => {
    const qa: QA = {
      id: 2,
      sex: "F",
      firstName: "Q",
      lastName: "A",
      salary: 2000,
      personType: PersonType.QA,
      morale: 80,
      buildingId: 1,
      testStat: 100,
      testMaxStat: 150,
      bugDetectionStat: 80,
      bugDetectionMaxStat: 120,
    };
    expect(employeTaskProgress(qa, {})).toBeNull();
  });
});
