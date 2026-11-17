import { FC, ReactNode, useEffect, useState } from "react";
import { Coins, Eye, UserPlus, WarningTriangle } from "iconoir-react";

import { Candidate, jobLabel } from "@/data/interface";
import { CandidateStatBars } from "@/components/employe/CandidateStatBars";
import { TraitBadges } from "@/components/employe/TraitBadges";
import { HireAmbiancePreview } from "@/components/employe/AmbiancePanel";
import { EmployeAvatar } from "@/components/employe/EmployeAvatar";
import { Modal } from "@/components/global/Modal";
import { rejectCandidate, revealCandidate } from "@/data/redux/employeSlice";
import { hireCandidateWithOffer } from "@/data/redux/recruitmentThunks";
import { setMoney } from "@/data/redux/companySlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { selectRemainingSlots } from "@/data/redux/selectors";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { startInterview } from "@/data/utils/interview";
import { isFounderResearching } from "@/data/utils/research";
import { useFounderSkill } from "@/data/hooks/useFounderSkill";
import { formatPrice } from "@/data/utils";
import {
  INTERVIEW_EXPRESS_FEE,
  INTERVIEW_HOURS,
  NEGO_HARD_REFUSE,
  NEGO_MAX_ROUNDS,
  SENIORITY_LABEL,
  Temperament,
  counterOffer,
  effectiveRatio,
  hireMoraleDelta,
  negotiationReaction,
} from "@/data/utils/recruitment";

// ─────────────────────────────────────────────────────────────────────────────
// Entretien et négociation d'embauche.
//
// En-tête : le candidat. À gauche, son profil (fourchettes avant l'entretien,
// valeurs exactes après). À droite, l'offre : montant, curseur posé sur une
// jauge qui montre comment l'offre sera reçue par rapport au salaire attendu
// (mêmes seuils que le barème de `negotiationReaction`). Une contre-offre ou un
// refus s'affichent comme une réplique du candidat.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  /** Candidat en cours d'entretien / négociation, ou null (modale fermée). */
  candidate: Candidate | null;
  onClose: () => void;
}

const TEMPERAMENT_LABEL: Record<Temperament, string> = {
  loyal: "Loyal · négocie peu",
  ambitieux: "Ambitieux · négocie dur",
  cameleon: "Caméléon · imprévisible",
};

// Offre de départ quand on ne sait rien du candidat : le curseur ne doit pas
// se poser sur son salaire attendu, ce serait le révéler.
const BLIND_OFFER = 2000;
// Plage du curseur à l'aveugle : fixe, pour ne rien trahir de l'attendu.
const BLIND_RANGE = { min: 1000, max: 4000 };
// Plage du curseur une fois l'attendu connu, en part de celui-ci.
const KNOWN_RANGE = { min: 0.6, max: 1.5 };
const STEP = 10;

/**
 * Zones de réception de l'offre (ratio offre / attendu), du bas au haut. Les
 * bornes suivent le barème de `negotiationReaction` : sous NEGO_HARD_REFUSE le
 * candidat se retire ; 0,9, 1,0 et 1,1 sont les paliers d'acceptation.
 */
const ZONES: { label: string; from: number; fill: string }[] = [
  { label: "Insultant", from: -Infinity, fill: "bg-[#e06a72]" },
  { label: "Risqué", from: NEGO_HARD_REFUSE, fill: "bg-[#f2b37a]" },
  { label: "Juste", from: 0.9, fill: "bg-[#ffe08a]" },
  { label: "Correct", from: 1.0, fill: "bg-[#a9ddb4]" },
  { label: "Généreux", from: 1.1, fill: "bg-[#6cc28a]" },
];

const zoneOf = (r: number) =>
  [...ZONES].reverse().find((z) => r >= z.from) ?? ZONES[0];

const round10 = (n: number) => Math.round(n / STEP) * STEP;

type Outcome =
  | { kind: "idle" }
  | { kind: "counter"; amount: number; roundsLeft: number }
  | { kind: "refused"; hard: boolean };

/** Réplique du candidat : bulle à côté de son avatar. */
const Speech = ({
  candidate,
  tone,
  children,
  action,
}: {
  candidate: Candidate;
  tone: "neutral" | "error";
  children: ReactNode;
  action?: ReactNode;
}) => (
  <div className="flex items-start gap-3">
    <EmployeAvatar employe={candidate} size={36} />
    <div
      role="status"
      className={
        "flex flex-1 flex-wrap items-center gap-3 rounded-[4px_18px_18px_18px] border-[2.5px] px-4 py-3 " +
        (tone === "error"
          ? "border-error bg-error/5 text-error"
          : "border-ink bg-white")
      }
    >
      <span className="flex-1 font-display text-lg leading-snug">
        {children}
      </span>
      {action}
    </div>
  </div>
);

export const HireNegotiationModal: FC<Props> = ({ candidate, onClose }) => {
  const dispatch = useAppDispatch();
  const money = useAppSelector((s) => s.company.money);
  // Plafond de recrutement (places des bâtiments) : refusé si l'effectif est plein.
  const capReached = useAppSelector(selectRemainingSlots) <= 0;
  // En formation, le fondateur n'est pas disponible pour un entretien.
  const founderResearching = useAppSelector(isFounderResearching);
  // En congés non plus.
  const founderAway = useAppSelector(
    (s) => s.employe.employeList.find((e) => e.id === 1)?.leaveUntil != null,
  );

  const revealed = candidate?.revealedStats ?? false;
  const expected = candidate?.expectedSalary ?? candidate?.salary ?? 0;
  // Salaire attendu et tempérament se lisent après l'entretien — ou sur
  // dossier, si le fondateur a appris à lire un CV. Les stats exactes, elles,
  // demandent toujours l'entretien.
  const hasCvReading = useFounderSkill("cv_reading");
  const knowsProfile = revealed || hasCvReading;
  // Caractère et traits : après entretien, ou sur dossier avec la formation.
  const knowsPersonality = useFounderSkill("character_reading") || revealed;

  const [offer, setOffer] = useState<number>(
    knowsProfile ? expected : BLIND_OFFER,
  );
  const [round, setRound] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  // Réinitialise l'état de négociation à chaque ouverture / changement de candidat.
  useEffect(() => {
    setRound(0);
    setOutcome({ kind: "idle" });
  }, [candidate?.id]);

  // L'offre se cale sur l'attendu dès qu'il est connu (y compris quand
  // l'entretien le révèle en cours de route), sans rouvrir les tours joués.
  useEffect(() => {
    setOffer(knowsProfile ? expected : BLIND_OFFER);
  }, [candidate?.id, expected, knowsProfile]);

  const name = candidate ? `${candidate.firstName} ${candidate.lastName}` : "";
  const temperament = (candidate?.temperament ?? "loyal") as Temperament;

  const range =
    knowsProfile && expected > 0
      ? {
          min: Math.max(STEP, round10(expected * KNOWN_RANGE.min)),
          max: round10(expected * KNOWN_RANGE.max),
        }
      : BLIND_RANGE;
  const setOfferClamped = (v: number) =>
    setOffer(Math.min(range.max, Math.max(range.min, round10(v))));

  // Volet A — entretien : révèle stats exactes, potentiel, attendu et
  // tempérament. Mené par le fondateur, il prend INTERVIEW_HOURS de jeu, écran
  // bloqué (`InterviewOverlay`) : la modale se ferme et se rouvre à la fin
  // (cf. PoleEmploye). Le « process RH express » coûte INTERVIEW_EXPRESS_FEE
  // et révèle tout sur-le-champ — l'arbitrage est temps du fondateur / cash.
  const runInterview = () => {
    if (!candidate) return;
    if (dispatch(startInterview(candidate.id))) onClose();
  };

  const runExpressInterview = () => {
    if (!candidate) return;
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
    dispatch(revealCandidate(candidate.id));
    dispatch(
      pushNotification({
        message: `Entretien mené avec ${name} : profil révélé.`,
        type: "info",
      }),
    );
  };

  const finalizeHire = (signed: number) => {
    if (!candidate) return;
    const delta = hireMoraleDelta(signed, expected);
    // Garde-fou plafond (§6.1) : le thunk refuse + toast si l'effectif est plein.
    const result = dispatch(
      hireCandidateWithOffer({
        candidateId: candidate.id,
        salary: signed,
        moraleDelta: delta,
      }),
    );
    if (result.ok) {
      dispatch(
        pushNotification({
          message: `${name} embauché·e à ${formatPrice(signed)} / mois.`,
          type: "success",
        }),
      );
    }
    onClose();
  };

  const reject = (hard: boolean) => {
    if (!candidate) return;
    dispatch(rejectCandidate(candidate.id));
    dispatch(
      pushNotification({
        message: hard
          ? `${name} se retire, vexé·e par l'offre.`
          : `Négociation rompue avec ${name}.`,
        type: "warning",
      }),
    );
    onClose();
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
  const hardRefused = outcome.kind === "refused" && outcome.hard;
  const lastRound =
    outcome.kind === "counter" ? outcome.roundsLeft === 0 : false;
  const currentRound = Math.min(round + 1, NEGO_MAX_ROUNDS);

  const ratio = expected > 0 ? offer / expected : 1;
  const zone = zoneOf(ratio);
  // Position (0..1) d'un ratio sur la jauge, bornée à la plage du curseur.
  const toPos = (r: number) =>
    Math.min(
      1,
      Math.max(
        0,
        (r * expected - range.min) / Math.max(1, range.max - range.min),
      ),
    );
  const zoneSegments = ZONES.map((z, i) => {
    const start = i === 0 ? 0 : toPos(z.from);
    const end = i === ZONES.length - 1 ? 1 : toPos(ZONES[i + 1].from);
    return { ...z, width: Math.max(0, end - start) };
  }).filter((z) => z.width > 0);

  return (
    <Modal
      open={candidate != null}
      onClose={onClose}
      ariaLabel="Entretien et négociation"
      size="3xl"
      className="p-0"
    >
      {candidate && (
        <>
          {/* En-tête : le candidat */}
          <div className="flex flex-wrap items-center gap-4 border-b-[3px] border-ink bg-white px-6 py-5">
            <EmployeAvatar employe={candidate} size={60} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <h3 className="font-display text-2xl leading-none font-bold">
                {name}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-base-content/70">
                  {jobLabel(candidate)}
                  {candidate.seniority &&
                    ` · ${SENIORITY_LABEL[candidate.seniority]}`}
                </span>
                {knowsPersonality ? (
                  <TraitBadges person={candidate} size="sm" />
                ) : (
                  <span className="rounded-full bg-base-200 px-2.5 py-0.5 text-xs font-extrabold text-base-content/70">
                    Traits inconnus
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-xs font-extrabold text-base-content/70">
                {lastRound
                  ? "Dernier tour"
                  : `Tour ${currentRound} sur ${NEGO_MAX_ROUNDS}`}
              </span>
              <span className="flex gap-1.5" aria-hidden="true">
                {Array.from({ length: NEGO_MAX_ROUNDS }, (_, i) => (
                  <span
                    key={i}
                    className={
                      "h-2.5 w-6 rounded-full border-2 border-ink " +
                      (i < round
                        ? "bg-ink"
                        : i === round
                          ? "bg-sun"
                          : "bg-white")
                    }
                  />
                ))}
              </span>
            </div>
          </div>

          <div className="space-y-4 px-6 py-5">
            {/* Réplique du candidat */}
            {outcome.kind === "counter" && (
              <Speech
                candidate={candidate}
                tone="neutral"
                action={
                  <button
                    type="button"
                    className="btn btn-success gap-1.5"
                    onClick={() => finalizeHire(outcome.amount)}
                    disabled={capReached}
                  >
                    <UserPlus width={16} height={16} />
                    Accepter {formatPrice(outcome.amount)} €
                  </button>
                }
              >
                « Pour <b>{formatPrice(outcome.amount)} €</b> par mois, je
                signe. »
              </Speech>
            )}
            {outcome.kind === "refused" && (
              <Speech candidate={candidate} tone="error">
                {outcome.hard
                  ? "Offre jugée insultante : le candidat se retire."
                  : "Offre refusée. Remontez votre proposition."}
              </Speech>
            )}

            {/* Plafond de recrutement §6.1 : embauche bloquée si l'effectif est plein. */}
            {capReached && (
              <div className="alert alert-warning py-2 text-sm">
                <WarningTriangle width={16} height={16} />
                Plafond d'effectif atteint — ouvre un nouveau studio pour
                recruter davantage.
              </div>
            )}

            {knowsPersonality && <HireAmbiancePreview candidate={candidate} />}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Profil */}
              <section className="toy-tile flex flex-col gap-3 p-4">
                <div className="flex items-baseline justify-between">
                  <h4 className="font-display text-base font-semibold">
                    Compétences
                  </h4>
                  <span className="text-xs font-extrabold text-base-content/70">
                    {revealed ? "Niveau · potentiel" : "Estimation"}
                  </span>
                </div>
                <CandidateStatBars candidate={candidate} />
                <dl className="space-y-2 border-t-[1.5px] border-base-300 pt-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="font-bold text-base-content/70">
                      Tempérament
                    </dt>
                    <dd
                      className={
                        "font-extrabold " +
                        (knowsProfile ? "" : "text-base-content/50")
                      }
                    >
                      {knowsProfile ? TEMPERAMENT_LABEL[temperament] : "?"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="font-bold text-base-content/70">
                      Salaire attendu
                    </dt>
                    <dd
                      className={
                        "font-extrabold tabular-nums " +
                        (knowsProfile ? "" : "text-base-content/50")
                      }
                    >
                      {knowsProfile
                        ? `≈ ${formatPrice(expected)} € / mois`
                        : "?"}
                    </dd>
                  </div>
                </dl>
                {!revealed && (
                  <div className="flex flex-col gap-2 border-t-[1.5px] border-base-300 pt-3">
                    <button
                      type="button"
                      className="btn btn-sm justify-between"
                      onClick={runInterview}
                      disabled={founderResearching || founderAway}
                      title={
                        founderResearching
                          ? "Le fondateur est en formation : il ne peut pas mener d'entretien."
                          : founderAway
                            ? "Le fondateur est en congés : il ne peut pas mener d'entretien."
                            : undefined
                      }
                    >
                      <span className="flex items-center gap-1.5">
                        <Eye width={16} height={16} />
                        Mener l'entretien
                      </span>
                      <span className="font-sans text-xs font-extrabold text-base-content/70">
                        {INTERVIEW_HOURS} h du fondateur
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm justify-between"
                      onClick={runExpressInterview}
                    >
                      <span className="flex items-center gap-1.5">
                        <Coins width={16} height={16} />
                        Process RH express
                      </span>
                      <span className="font-sans text-xs font-extrabold text-base-content/70">
                        {formatPrice(INTERVIEW_EXPRESS_FEE)} €
                      </span>
                    </button>
                  </div>
                )}
              </section>

              {/* Offre */}
              <section className="toy-tile flex flex-col gap-3 p-4">
                <h4 className="font-display text-base font-semibold">
                  Votre offre
                </h4>
                <div className="flex items-center justify-center gap-4 py-1">
                  <button
                    type="button"
                    className="btn btn-sm btn-square font-display text-xl"
                    aria-label={`Baisser de ${STEP} €`}
                    onClick={() => setOfferClamped(offer - STEP)}
                    disabled={!canPropose || offer <= range.min}
                  >
                    −
                  </button>
                  <div className="text-center leading-none">
                    <div className="font-display text-4xl font-bold tabular-nums">
                      {formatPrice(offer)}
                    </div>
                    <div className="mt-1 text-xs font-extrabold text-base-content/70">
                      € / mois
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-square font-display text-xl"
                    aria-label={`Monter de ${STEP} €`}
                    onClick={() => setOfferClamped(offer + STEP)}
                    disabled={!canPropose || offer >= range.max}
                  >
                    +
                  </button>
                </div>

                {/* Jauge de réception, curseur posé dessus */}
                <div className="space-y-1.5">
                  <div className="relative h-5">
                    <div className="absolute inset-x-0 top-0 flex h-5 overflow-hidden rounded-full border-[2.5px] border-ink bg-base-300">
                      {knowsProfile &&
                        zoneSegments.map((z, i) => (
                          <span
                            key={z.label}
                            className={`block h-full border-ink ${z.fill} ${i < zoneSegments.length - 1 ? "border-r-2" : ""}`}
                            style={{ width: `${z.width * 100}%` }}
                          />
                        ))}
                    </div>
                    <input
                      type="range"
                      className="offer-range absolute inset-x-0 top-0 h-5 w-full"
                      min={range.min}
                      max={range.max}
                      step={STEP}
                      value={offer}
                      disabled={!canPropose}
                      onChange={(e) => setOfferClamped(Number(e.target.value))}
                      aria-label="Offre de salaire"
                      aria-valuetext={`${formatPrice(offer)} € par mois`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm font-extrabold">
                  {knowsProfile ? (
                    <>
                      <span
                        className={`rounded-full border-2 border-ink px-3 py-0.5 ${zone.fill}`}
                      >
                        {zone.label}
                      </span>
                      <span className="text-base-content/70">
                        {Math.round(ratio * 100)} % de l'attendu
                      </span>
                    </>
                  ) : (
                    <span className="rounded-full bg-base-200 px-3 py-0.5 text-base-content/70">
                      Attendu inconnu
                    </span>
                  )}
                </div>
              </section>
            </div>
          </div>

          {/* Pied */}
          <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t-[3px] border-ink bg-white px-6 py-4">
            {hardRefused ? (
              <button
                type="button"
                className="btn btn-primary ml-auto"
                onClick={() => reject(true)}
              >
                Fermer
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-ghost underline underline-offset-4"
                  onClick={() => reject(false)}
                >
                  Abandonner
                </button>
                {canPropose && (
                  <button
                    type="button"
                    className="btn btn-primary ml-auto"
                    onClick={propose}
                  >
                    Proposer {formatPrice(offer)} €
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
};
