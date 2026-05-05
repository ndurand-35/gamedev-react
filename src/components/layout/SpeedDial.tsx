import { Plus } from "iconoir-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

export const SpeedDial = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <div
      className="fixed right-12 bottom-24 group"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div
        className={
          "flex-col items-center mb-4 space-y-2 " + (isOpen ? "flex" : "hidden")
        }
      >
        <div className="tooltip tooltip-left" data-tip="Signer un contrat">
          <NavLink
            to="/game/task"
            aria-label="Signer un contrat"
            className="btn btn-circle"
          >
            <Plus width={24} height={24} />
          </NavLink>
        </div>
      </div>

      <button
        type="button"
        aria-label="Actions rapides"
        aria-expanded={isOpen}
        className="btn btn-circle btn-primary group-hover:rotate-45"
      >
        <Plus width={32} height={32} />
      </button>
    </div>
  );
};
