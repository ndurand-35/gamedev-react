import { ReactElement, ReactNode, useEffect, useId, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Modale du jeu, sur le <dialog> natif.
//
// Le <dialog> reste toujours monté : son ouverture suit `open` (un showModal()
// sur un nœud absent du DOM échouerait). Toute fermeture native — Échap, clic
// sur le voile, bouton dans un <form method="dialog"> — remonte par `onClose`.
// Fermer depuis le contenu : appeler `onClose()` directement. Le parent passe
// alors `open` à false et la fermeture qui s'ensuit n'appelle pas `onClose` une
// seconde fois.
// ─────────────────────────────────────────────────────────────────────────────

const SIZE_CLASS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Titre en tête de modale ; il nomme aussi la modale pour l'accessibilité. */
  title?: ReactNode;
  /** Icône posée devant le titre. */
  icon?: ReactNode;
  /** Nom accessible, quand la modale n'a pas de titre visible. */
  ariaLabel?: string;
  /** Largeur maximale (défaut : `md`). */
  size?: keyof typeof SIZE_CLASS;
  /** Pied de modale : les boutons d'action, alignés à droite. */
  actions?: ReactNode;
  /** Un clic sur le voile ferme la modale (défaut : oui). */
  dismissable?: boolean;
  /** Classes ajoutées au cadre (`modal-box`). */
  className?: string;
  children?: ReactNode;
}

export const Modal = ({
  open,
  onClose,
  title,
  icon,
  ariaLabel,
  size = "md",
  actions,
  dismissable = true,
  className = "",
  children,
}: ModalProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Lu dans l'événement `close` : vrai si la fermeture vient du joueur (la
  // modale était censée rester ouverte), faux si le parent l'a demandée.
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : ariaLabel}
      onClose={() => {
        if (openRef.current) onClose();
      }}
    >
      <div className={`modal-box ${SIZE_CLASS[size]} ${className}`}>
        {title && (
          <h3
            id={titleId}
            className="mb-4 flex items-center gap-2 font-display text-xl font-semibold"
          >
            {icon}
            {title}
          </h3>
        )}
        {children}
        {actions && <div className="modal-action">{actions}</div>}
      </div>
      {dismissable && (
        <form method="dialog" className="modal-backdrop">
          <button type="submit" aria-label="Fermer" tabIndex={-1}>
            Fermer
          </button>
        </form>
      )}
    </dialog>
  );
};
