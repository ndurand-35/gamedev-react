import {
  COMPONENT_GRAIN,
  Component,
  ComponentQuality,
  ComponentType,
  Contract,
  ContractType,
} from "@/data/interface";

// ─────────────────────────────────────────────────────────────────────────────
// Le premier contrat d'une partie : toujours le même, et couvert par le stock
// de départ. Le joueur peut le signer et le livrer tout de suite — c'est la
// première étape du tutoriel. Il revient dans chaque lot tant que le studio
// n'a encore rien signé. Module sans dépendance (interface seule) : les états
// par défaut et le slice des contrats l'importent.
// ─────────────────────────────────────────────────────────────────────────────

export const FIRST_CONTRACT_CLIENT = {
  id: "first-contract-atelier-nova",
  name: "Atelier Nova",
  image: "",
};

/** Un petit programme : dix composants Code, cinq UX, sans exigence de qualité. */
export const firstContract = (): Contract => ({
  id: 0,
  name: "Programme de facturation",
  // Un mois : largement de quoi livrer, même en attendant d'y penser.
  time: 30 * 24,
  priceDeposit: 250,
  priceAdditional: 900,
  priceMalus: 600,
  clientId: FIRST_CONTRACT_CLIENT.id,
  clientName: FIRST_CONTRACT_CLIENT.name,
  clientImage: FIRST_CONTRACT_CLIENT.image,
  loyaltyBonus: 0,
  type: ContractType.DEV,
  taskDifficulty: 2,
  requirements: [
    { type: ComponentType.CODE, quantity: 2 * COMPONENT_GRAIN },
    { type: ComponentType.UX, quantity: 1 * COMPONENT_GRAIN },
  ],
});

/** Personne ne les a produits : ils étaient là à l'ouverture du garage. */
export const STARTER_PRODUCER = 0;

/** Stock de départ : exactement ce que demande le premier contrat. */
export const starterStock = (): Component[] =>
  firstContract().requirements.flatMap((req) =>
    Array.from({ length: req.quantity }, () => ({
      type: req.type,
      quality: ComponentQuality.CORRECT,
      producedBy: STARTER_PRODUCER,
      producedAt: 0,
    })),
  ).map((c, i) => ({ ...c, id: i + 1 }));
