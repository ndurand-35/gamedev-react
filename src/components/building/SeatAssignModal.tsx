import { FC, ReactElement, useMemo } from "react";
import { Link } from "react-router-dom";
import { Desk } from "iconoir-react";

import { Building, Employe, jobLabel } from "@/data/interface";
import { assignBuilding } from "@/data/redux/employeSlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { EmployeTag } from "@/components/employe/MoraleIcon";
import { Modal } from "@/components/global/Modal";

export interface SeatAssignModalProps {
  /** Bâtiment dont on remplit une place, ou null quand la modale est fermée. */
  building: Building | null;
  onClose: () => void;
}

const fullName = (emp: Employe): string => `${emp.firstName} ${emp.lastName}`;

// Modale ouverte depuis une place libre de l'Accueil : on choisit qui s'y
// installe. Les employés sans bureau passent devant (ils sont payés à ne rien
// faire), puis ceux d'un autre bâtiment, que l'on peut faire déménager.
// Même contrat que les autres modales : `building` pilote l'ouverture
// (cf. Modal).
export const SeatAssignModal: FC<SeatAssignModalProps> = ({
  building,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const employeList = useAppSelector((s) => s.employe.employeList);
  const buildingList = useAppSelector((s) => s.company.buildingList);

  const { unhoused, elsewhere } = useMemo(() => {
    const unhoused: Employe[] = [];
    const elsewhere: Employe[] = [];
    if (!building) return { unhoused, elsewhere };
    for (const emp of employeList) {
      if (emp.buildingId == null) unhoused.push(emp);
      else if (emp.buildingId !== building.id) elsewhere.push(emp);
    }
    return { unhoused, elsewhere };
  }, [employeList, building]);

  const buildingName = (id: number | undefined): string =>
    buildingList.find((b) => b.id === id)?.name ?? "";

  const seat = (emp: Employe) => {
    if (!building) return;
    dispatch(
      assignBuilding({
        employeId: emp.id,
        buildingId: building.id,
        buildingPlace: building.place,
      }),
    );
    onClose();
  };

  const renderRow = (emp: Employe, detail: string): ReactElement => (
    <li key={emp.id}>
      <button
        type="button"
        onClick={() => seat(emp)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-base-200"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{fullName(emp)}</span>
          <span className="block truncate text-xs opacity-60">{detail}</span>
        </span>
        <EmployeTag employe={emp} />
      </button>
    </li>
  );

  const empty = unhoused.length === 0 && elsewhere.length === 0;

  return (
    <Modal
      open={building !== null}
      onClose={onClose}
      size="md"
      title="Installer un employé"
      icon={<Desk width={20} height={20} className="opacity-70" />}
      actions={
        <form method="dialog">
          <button type="submit" className="btn">
            Fermer
          </button>
        </form>
      }
    >
      {empty ? (
        <p className="py-4 text-center text-sm opacity-70">
          Tous vos employés sont déjà ici.{" "}
          <Link
            to="/game/employe/recruit"
            className="link font-bold"
            onClick={onClose}
          >
            Recruter
          </Link>
        </p>
      ) : (
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {unhoused.length > 0 && (
            <section>
              <h4 className="px-3 pb-1 text-xs font-semibold uppercase opacity-60">
                Sans bureau
              </h4>
              <ul>{unhoused.map((emp) => renderRow(emp, jobLabel(emp)))}</ul>
            </section>
          )}
          {elsewhere.length > 0 && (
            <section>
              <h4 className="px-3 pb-1 text-xs font-semibold uppercase opacity-60">
                Dans un autre bâtiment
              </h4>
              <ul>
                {elsewhere.map((emp) =>
                  renderRow(
                    emp,
                    `${jobLabel(emp)} · ${buildingName(emp.buildingId)}`,
                  ),
                )}
              </ul>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
};
