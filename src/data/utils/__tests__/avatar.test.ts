import { describe, expect, it } from "vitest";

import employeReducer, { hire, setAvatar } from "@/data/redux/employeSlice";
import type { EmployeState } from "@/data/redux/employeSlice";
import { AvatarConfig, PersonType, type Person } from "@/data/interface";
import {
  AVATAR_EYES,
  AVATAR_FACES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIRS,
  AVATAR_MOUTHS,
  AVATAR_SKINS,
  avatarOf,
  randomAvatar,
} from "@/data/utils/avatar";

const ids = (list: { id: string }[]) => list.map((o) => o.id);

const isValid = (a: AvatarConfig) =>
  ids(AVATAR_FACES).includes(a.face) &&
  ids(AVATAR_EYES).includes(a.eyes) &&
  ids(AVATAR_MOUTHS).includes(a.mouth) &&
  ids(AVATAR_HAIRS).includes(a.hair) &&
  ids(AVATAR_SKINS).includes(a.skin) &&
  ids(AVATAR_HAIR_COLORS).includes(a.hairColor);

const ADA: AvatarConfig = {
  face: "carre",
  skin: "#8E5A36",
  eyes: "lunettes",
  mouth: "coin",
  hair: "afro",
  hairColor: "#4F86E8",
};

describe("avatar", () => {
  it("tire toujours des parties qui existent", () => {
    for (let i = 0; i < 200; i++) expect(isValid(randomAvatar())).toBe(true);
  });

  it("garde l'avatar choisi", () => {
    expect(
      avatarOf({ firstName: "Ada", lastName: "Lovelace", avatar: ADA }),
    ).toBe(ADA);
  });

  it("sans avatar, en dérive un du nom, toujours le même", () => {
    const a = avatarOf({ firstName: "Jean", lastName: "Dupont" });
    expect(isValid(a)).toBe(true);
    expect(avatarOf({ firstName: "Jean", lastName: "Dupont" })).toEqual(a);
  });

  it("des noms différents donnent des têtes variées", () => {
    const names = ["Inès", "Paul", "Chloé", "Hugo", "Maëlle", "Théo", "Sofia"];
    const looks = new Set(
      names.map((n) =>
        JSON.stringify(avatarOf({ firstName: n, lastName: "Martin" })),
      ),
    );
    expect(looks.size).toBe(names.length);
  });

  it("les cheveux fantaisie restent rares", () => {
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const fancy = new Set(["#4F86E8", "#E86A9A"]);
    let count = 0;
    for (let i = 0; i < 2000; i++) {
      if (fancy.has(randomAvatar(random).hairColor)) count++;
    }
    expect(count / 2000).toBeGreaterThan(0.06);
    expect(count / 2000).toBeLessThan(0.2);
  });
});

describe("employeSlice / avatar", () => {
  const state = (overrides: Partial<EmployeState> = {}): EmployeState => ({
    employeList: [],
    candidateList: [],
    nextEmployeId: 2,
    nextCandidateId: 1,
    ...overrides,
  });
  const person = (id: number, avatar?: AvatarConfig): Person => ({
    id,
    sex: "F",
    firstName: "Ada",
    lastName: "Lovelace",
    salary: 0,
    personType: PersonType.PROD,
    morale: 70,
    avatar,
  });

  it("l'embauche garde l'avatar du candidat", () => {
    const next = employeReducer(
      state({ candidateList: [person(1, ADA)] }),
      hire(1),
    );
    expect(next.employeList[0].avatar).toEqual(ADA);
  });

  it("setAvatar change l'apparence d'un employé", () => {
    const next = employeReducer(
      state({ employeList: [person(1)] }),
      setAvatar({ employeId: 1, avatar: ADA }),
    );
    expect(next.employeList[0].avatar).toEqual(ADA);
  });
});
