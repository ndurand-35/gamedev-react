// ── Aménagements : achat, revente et garde-fous ─────────────────────────────
// Le catalogue et ses effets purs vivent dans `interface/amenity` ; ici, ce
// que le joueur peut faire, et pourquoi il ne le peut pas.

import {
  AMENITY_BY_ID,
  AmenityDef,
  AmenityId,
  Building,
  buildingSeats,
} from "@/data/interface";
import { installAmenity, removeAmenity } from "@/data/redux/companySlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import type { AppDispatch, RootState } from "@/data/redux/store";
import { formatPrice } from "@/data/utils";
import { getTimeAsDate } from "@/data/utils/time";

export type AmenityBlocker = "owned" | "era" | "room" | "money";

/** Pourquoi cet aménagement ne peut pas s'acheter maintenant, ou null. */
export const amenityBlocker = (
  def: AmenityDef,
  building: Building,
  occupants: number,
  money: number,
  time: number,
): AmenityBlocker | null => {
  if (building.amenities?.includes(def.id)) return "owned";
  if (getTimeAsDate(time).year() < def.year) return "era";
  if (def.places > buildingSeats(building) - occupants) return "room";
  if (money < def.price) return "money";
  return null;
};

export const amenityBlockerLabel = (
  blocker: AmenityBlocker,
  def: AmenityDef,
): string => {
  switch (blocker) {
    case "owned":
      return "Déjà installé";
    case "era":
      return `Dès ${def.year}`;
    case "room":
      return "Plus de place libre";
    case "money":
      return "Fonds insuffisants";
  }
};

const occupantsOf = (state: RootState, buildingId: number): number =>
  state.employe.employeList.filter((e) => e.buildingId === buildingId).length;

/** Achète et installe un aménagement dans un bâtiment. */
export const buyAmenity =
  (buildingId: number, amenityId: AmenityId) =>
  (dispatch: AppDispatch, getState: () => RootState): boolean => {
    const state = getState();
    const building = state.company.buildingList.find((b) => b.id === buildingId);
    const def = AMENITY_BY_ID[amenityId];
    if (!building || !def) return false;
    const blocker = amenityBlocker(
      def,
      building,
      occupantsOf(state, buildingId),
      state.company.money,
      state.engine.time,
    );
    if (blocker) return false;
    dispatch(installAmenity({ buildingId, amenityId }));
    dispatch(
      pushNotification({
        message: `Nouvel aménagement à ${building.name} : ${def.name} (${formatPrice(def.price)} €).`,
        type: "success",
      }),
    );
    return true;
  };

/** Revend un aménagement : il libère sa place, une part du prix revient. */
export const sellAmenity =
  (buildingId: number, amenityId: AmenityId) =>
  (dispatch: AppDispatch, getState: () => RootState): boolean => {
    const building = getState().company.buildingList.find(
      (b) => b.id === buildingId,
    );
    if (!building?.amenities?.includes(amenityId)) return false;
    dispatch(removeAmenity({ buildingId, amenityId }));
    return true;
  };
