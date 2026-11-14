import { FC, useEffect, useState } from "react";
import { EditPencil } from "iconoir-react";

import { AvatarConfig, Employe } from "@/data/interface";
import { avatarOf } from "@/data/utils/avatar";
import { setAvatar } from "@/data/redux/employeSlice";
import { useAppDispatch } from "@/data/redux/hooks";
import { Modal } from "@/components/global/Modal";
import { AvatarEditor } from "@/components/employe/AvatarEditor";
import { EmployeAvatar } from "@/components/employe/EmployeAvatar";

interface AvatarEditModalProps {
  employe: Employe;
  open: boolean;
  onClose: () => void;
}

/**
 * Retoucher l'apparence d'une personne (le fondateur, depuis sa fiche). Les
 * changements restent un brouillon jusqu'à « Enregistrer ».
 */
export const AvatarEditModal: FC<AvatarEditModalProps> = ({
  employe,
  open,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const [draft, setDraft] = useState<AvatarConfig>(() => avatarOf(employe));

  // Chaque ouverture repart de l'apparence enregistrée.
  useEffect(() => {
    if (open) setDraft(avatarOf(employe));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = () => {
    dispatch(setAvatar({ employeId: employe.id, avatar: draft }));
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apparence"
      icon={<EditPencil width={18} height={18} strokeWidth={2.4} />}
      size="5xl"
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex justify-center sm:block">
          <EmployeAvatar employe={{ ...employe, avatar: draft }} size={120} />
        </div>
        <div className="min-w-0 flex-1">
          <AvatarEditor
            value={draft}
            onChange={setDraft}
            personType={employe.personType}
          />
        </div>
      </div>
    </Modal>
  );
};
