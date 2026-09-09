import { FC, useEffect, useMemo, useRef, useState } from "react";
import { Coins, Eye, HandCard, UserPlus, WarningTriangle } from "iconoir-react";

import {
  Candidate,
  Marketing,
  PersonType,
  ProductionPerson,
  QA,
} from "@/data/interface";
import {
  rejectCandidate,
  revealCandidate,
} from "@/data/redux/employeSlice";
import { hireCandidateWithOffer } from "@/data/redux/recruitmentThunks";
import { setMoney } from "@/data/redux/companySlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { selectRemainingSlots } from "@/data/redux/selectors";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
import {
  INTERVIEW_EXPRESS_FEE,
  NEGO_MAX_ROUNDS,
  Temperament,
  counterOffer,
  effectiveRatio,
  hireMoraleDelta,
  negotiationReaction,
} from "@/data/utils/recruitment";

interface Props {
  /** Candidat en cours d'entretien / négociation, ou null (modale fermée). */
  candidate: Candidate | null;
  onClose: () => void;
}

const TEMPERAMENT_LABEL: Record<Temperament, string> = {
  loyal: "Loyal (négocie peu)",
  ambitieux: "Ambitieux (négocie dur)",
  cameleon: "Caméléon (imprévisible)",
};

// Fourchette floue d'une stat tant que l'entretien n'a pas eu lieu (volet A).
const fuzzy = (v: number): string => {
  const lo = Math.max(0, v - 2);
  const hi = Math.min(20, v + 2);
  return `${lo}–${hi}`;
};

type Outcome =
  | { kind: "idle" }
  | { kind: "counter"; amount: number; roundsLeft: number }
  | { kind: "refused"; hard: boolean };

export const HireNegotiationModal: FC<Props> = ({ candidate, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dispatch = useAppDispatch();
  const money = useAppSelector((s) => s.company.money);
  // Plafond de recrutement (places des bâtiments) : refusé si l'effectif est plein.
  const capReached = useAppSelector(selectRemainingSlots) <= 0;

  const open = candidate !== null;
  const revealed = candidate?.revealedStats ?? false;
  const expected = candidate?.expectedSalary ?? candidate?.salary ?? 0;

  const [offer, setOffer] = useState<number>(expected);
  const [round, setRound] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  // Réinitialise l'état de négociation à chaque ouverture / changement de candidat.
  useEffect(() => {
    setOffer(expected);
    setRound(0);
    setOutcome({ kind: "idle" });
  }, [candidate?.id, expected]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const prod =
    candidate?.personType === PersonType.PROD
      ? (candidate as ProductionPerson)
      : null;
  const qa = candidate?.personType === PersonType.QA ? (candidate as QA) : null;
  const mkt =
    candidate?.personType === PersonType.MARKETING
      ? (candidate as Marketing)
      : null;

  const stats = useMemo(() => {
    if (prod)
      return [
        ["Code", prod.codeStat],
        ["Visuel", prod.visualStat],
        ["UX", prod.uxStat],
      ] as const;
    if (qa)
      return [
        ["Test", qa.testStat],
        ["Détection bugs", qa.bugDetectionStat],
      ] as const;
    if (mkt)
      return [
        ["Communication", mkt.communicationStat],
        ["Gestion campagne", mkt.campaignManagementStat],
      ] as const;
    return [] as const;
  }, [prod, qa, mkt]);

  if (!candidate) return null;
  const name = `${candidate.firstName} ${candidate.lastName}`;
  const temperament = (candidate.temperament ?? "loyal") as Temperament;

  const closeModal = () => {
    dialogRef.current?.close();
    onClose();
  };

  // Volet A — entretien : révèle stats exactes + attendu + tempérament.
  // « Entretien » est gratuit (temps de jeu) ; « process RH express » coûte
  // INTERVIEW_EXPRESS_FEE mais c'est le même résultat — l'arbitrage est cash/risque.
  const runInterview = (paid: boolean) => {
    if (paid) {
      if (money < INTERVIEW_EXPRESS_FEE) {
        dispatch(
          pushNotification({
            message: "Trésorerie insuffisante pour le process RH express.",
            type: "error",
          }),
        );
        return;
      }
      dispatch(setMoney(money - INTERVIEW_EXPRESS_FEE));
    }
    dispatch(revealCandidate(candidate.id));
    dispatch(
      pushNotification({
        message: `Entretien mené avec ${name} : profil révélé.`,
        type: "info",
      }),
    );
  };

  const finalizeHire = (signed: number) => {
    const delta = hireMoraleDelta(signed, expected);
    // Garde-fou plafond (§6.1) : le thunk refuse + toast si l'effectif est plein.
    const result = dispatch(
      hireCandidateWithOffer({
        candidateId: candidate.id,
        salary: signed,
        moraleDelta: delta,
      }),
    );
    if (!result.ok) {
      closeModal();
      return;
    }
    dispatch(
      pushNotification({
        message: `${name} embauché·e à ${formatPrice(signed)} / mois.`,
        type: "success",
      }),
    );
    closeModal();
  };

  const reject = (hard: boolean) => {
    dispatch(rejectCandidate(candidate.id));
    dispatch(
      pushNotification({
        message: hard
          ? `${name} se retire, vexé·e par l'offre.`
          : `Négociation rompue avec ${name}.`,
        type: "warning",
      }),
    );
    closeModal();
  };

  // Volet B — proposer une offre : résout la réaction (barème §3.2), modulée par
  // le tempérament. Boucle ≤ NEGO_MAX_ROUNDS tours.
  const propose = () => {
    const r = expected > 0 ? offer / expected : 1;
    const cameleonRoll = Math.random() * 2 - 1;
    const rEff = effectiveRatio(r, temperament, cameleonRoll);
    const { reaction, hardRefuse } = negotiationReaction(rEff, Math.random());
    const usedRound = round + 1;
    setRound(usedRound);

    if (reaction === "accept") {
      finalizeHire(offer);
      return;
    }
    if (reaction === "refuse") {
      if (hardRefuse || usedRound >= NEGO_MAX_ROUNDS) {
        setOutcome({ kind: "refused", hard: hardRefuse });
        return;
      }
      setOutcome({ kind: "refused", hard: false });
      return;
    }
    // Contre-offre
    const counter = counterOffer(offer, expected, temperament, Math.random());
    setOutcome({
      kind: "counter",
      amount: counter,
      roundsLeft: NEGO_MAX_ROUNDS - usedRound,
    });
  };

  const canPropose =
    !capReached &&
    (outcome.kind === "idle" ||
      (outcome.kind === "counter" && outcome.roundsLeft > 0) ||
      (outcome.kind === "refused" && !outcome.hard && round < NEGO_MAX_ROUNDS));

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      role="dialog"
      aria-label="Entretien et négociation"
      onClose={onClose}
    >
      <div className="modal-box max-w-lg">
        <div className="flex items-center gap-3 mb-3">
          <div className="avatar avatar-placeholder">
            <div className="bg-neutral text-neutral-content rounded-full w-10">
              <span className="uppercase text-sm">
                {candidate.firstName[0]}
                {candidate.lastName[0]}
              </span>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg">{name}</h3>
            <p className="text-xs opacity-70">
              {prod?.specialty ?? candidate.personType}
            </p>
          </div>
        </div>

        {/* Stats : floues avant entretien, exactes après (volet A). */}
        <h4 className="font-semibold text-sm mb-1">
          Statistiques {revealed ? "" : "(estimées)"}
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm mb-3">
          {stats.map(([label, v]) => (
            <div key={label} className="flex justify-between">
              <span>{label}</span>
              <span className="tabular-nums opacity-80">
                {revealed ? v : fuzzy(v as number)}
              </span>
            </div>
          ))}
        </div>

        {revealed ? (
          <div className="text-sm mb-3 space-y-0.5">
            <div className="flex justify-between">
              <span>Tempérament</span>
              <span className="opacity-80">{TEMPERAMENT_LABEL[temperament]}</span>
            </div>
            <div className="flex justify-between">
              <span>Salaire attendu</span>
              <span className="tabular-nums font-medium">
                ≈ {formatPrice(expected)} / mois
              </span>
            </div>
          </div>
        ) : (
          <div className="alert alert-warning text-xs mb-3 py-2">
            <WarningTriangle width={16} height={16} />
            Profil non vérifié : stats estimées, salaire attendu et tempérament
            inconnus. Négocier à l'aveugle est risqué.
          </div>
        )}

        {/* Volet A — entretien */}
        {!revealed && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              className="btn btn-sm btn-outline gap-1"
              onClick={() => runInterview(false)}
            >
              <Eye width={16} height={16} /> Mener l'entretien (temps)
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline gap-1"
              onClick={() => runInterview(true)}
            >
              <Coins width={16} height={16} /> Process RH express (
              {formatPrice(INTERVIEW_EXPRESS_FEE)})
            </button>
          </div>
        )}

        {/* Feedback plafond recrutement §6.1 : embauche bloquée si effectif plein. */}
        {capReached && (
          <div className="alert alert-warning text-xs mb-3 py-2">
            <WarningTriangle width={16} height={16} />
            Plafond d'effectif atteint — ouvre un nouveau studio pour recruter
            davantage.
          </div>
        )}

        {/* Volet B — négociation */}
        <h4 className="font-semibold text-sm mb-1">Offre de salaire</h4>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="range"
            min={1000}
            max={3600}
            step={10}
            value={offer}
            onChange={(e) => setOffer(Number(e.target.value))}
            className="range range-sm range-primary flex-1"
          />
          <span className="tabular-nums font-medium w-24 text-right">
            {formatPrice(offer)}
          </span>
        </div>
        {revealed && (
          <p className="text-xs opacity-60 mb-2">
            Repère : attendu ≈ {formatPrice(expected)} ({Math.round((offer / expected) * 100)}
            % de l'attendu)
          </p>
        )}

        {outcome.kind === "counter" && (
          <div className="alert alert-info text-sm mb-2 py-2">
            <HandCard width={18} height={18} />
            <span>
              Contre-offre : {name} demande {formatPrice(outcome.amount)} / mois.
              {outcome.roundsLeft > 0
                ? " Vous pouvez re-proposer une fois."
                : " Dernier tour."}
            </span>
          </div>
        )}
        {outcome.kind === "refused" && (
          <div className="alert alert-warning text-sm mb-2 py-2">
            <WarningTriangle width={18} height={18} />
            <span>
              {outcome.hard
                ? "Offre jugée insultante : le candidat se retire."
                : "Offre refusée. Remontez votre proposition."}
            </span>
          </div>
        )}

        <div className="modal-action flex-wrap gap-2">
          {outcome.kind === "counter" && (
            <button
              type="button"
              className="btn btn-sm btn-success gap-1"
              onClick={() => finalizeHire(outcome.amount)}
              disabled={capReached}
              aria-disabled={capReached}
            >
              <UserPlus width={16} height={16} /> Accepter{" "}
              {formatPrice(outcome.amount)}
            </button>
          )}
          {canPropose && (
            <button
              type="button"
              className="btn btn-sm btn-primary gap-1"
              onClick={propose}
            >
              <HandCard width={16} height={16} /> Proposer{" "}
              {formatPrice(offer)}
            </button>
          )}
          {outcome.kind === "refused" && outcome.hard ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => reject(true)}
            >
              Fermer
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => reject(false)}
            >
              Abandonner
            </button>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
};
