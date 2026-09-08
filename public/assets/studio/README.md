# Assets studio

Reliquat du lot d'assets iso **MYL-17**. La scène isométrique de l'Accueil a été
retirée au profit des vues **cartes / liste / tableau**
(`src/components/building/BuildingEmployeView.tsx`) : dalles, murs, mobilier,
personnages, overlays, icônes de rôle et cadres de HUD ont été supprimés avec
elle.

Il ne reste que ce qui sert encore :

```
hud/candidate-card.svg   carte candidat du recrutement (Pôle Emploi)
manifest.json            contrat de recolorage + slots de la carte
```

## Recolorage

La carte est inlinée par `InlineSvg` (`src/components/studio/InlineSvg.tsx`), qui
pose les CSS custom properties sur l'élément hôte — un `<img>` n'hériterait pas
des variables CSS. `--accent` est dérivé de la spécialité ou du rôle
(`src/components/studio/isoStudio.ts`).

Les `#id` du markup (`#name`, `#role`, `#expected`, `#interview`) sont pilotés
depuis `CandidateCard.tsx` : toute modification du SVG doit les préserver.
