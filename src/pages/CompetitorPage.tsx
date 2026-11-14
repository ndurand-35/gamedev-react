import { ReactElement } from "react";

import { CompetitorTable } from "@/components/competitor";
import { TopMenuItem } from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";

const pageTopMenuItems: TopMenuItem[] = [];

/**
 * Concurrents : les studios du marché et l'état de notre relation avec chacun
 * (ex-carnet d'adresses de la page Contrats). Pour l'instant ils ne font que
 * nous confier des contrats ; c'est ici que se lira, plus tard, ce qu'ils
 * lancent face à nos produits.
 */
export const CompetitorPage: React.FC = (): ReactElement => {
  useTopMenu(pageTopMenuItems);
  return (
    <div className="page-shell">
      <div className="toy-frame page-frame space-y-5">
        <h1 className="font-display text-2xl font-bold">Concurrents</h1>
        <CompetitorTable />
      </div>
    </div>
  );
};
