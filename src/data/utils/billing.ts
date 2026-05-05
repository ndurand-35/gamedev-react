import {
  PAID_MORALE_BONUS,
  Person,
  ProductStatus,
  RESIGNATION_MORALE_THRESHOLD,
  UNPAID_MORALE_PENALTY,
  getBuildingMonthlyCharges,
} from "@/data/interface";
import { setMoney } from "@/data/redux/companySlice";
import {
  adjustMorale,
  resignEmploye,
} from "@/data/redux/employeSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { AppDispatch, RootState } from "@/data/redux/store";
import { formatPrice } from "@/data/utils";
import { getTimeAsDate } from "@/data/utils/time";

const RESIGNATION_CHANCE_PER_TICK = 0.005;

export const processMonthlyBilling = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  const date = getTimeAsDate(state.engine.time);
  const isBillingTime =
    date.add(1, "day").date() === 1 && date.hour() === 23;
  if (!isBillingTime) return;

  let money = state.company.money;

  let totalCharges = 0;
  for (const b of state.company.buildingList) {
    totalCharges += getBuildingMonthlyCharges(b);
  }
  money -= totalCharges;

  // Revenu passif des produits lancés
  let totalRevenue = 0;
  for (const p of state.product.products) {
    if (p.status === ProductStatus.LAUNCHED) {
      totalRevenue += p.monthlyRevenue;
    }
  }
  money += totalRevenue;

  const paid: Person[] = [];
  const unpaid: Person[] = [];

  for (const emp of state.employe.employeList) {
    if (money >= emp.salary) {
      money -= emp.salary;
      paid.push(emp);
    } else {
      unpaid.push(emp);
    }
  }

  dispatch(setMoney(money));

  for (const e of paid) {
    dispatch(adjustMorale({ employeId: e.id, delta: PAID_MORALE_BONUS }));
  }
  for (const e of unpaid) {
    dispatch(adjustMorale({ employeId: e.id, delta: -UNPAID_MORALE_PENALTY }));
  }

  if (unpaid.length > 0) {
    dispatch(
      pushNotification({
        message: `Salaires impayés : ${unpaid.length} employé${unpaid.length > 1 ? "s" : ""} — moral en chute`,
        type: "error",
      }),
    );
  } else if (paid.length > 0) {
    const totalPayroll = paid.reduce((acc, e) => acc + e.salary, 0);
    dispatch(
      pushNotification({
        message: `Paie versée : ${formatPrice(totalPayroll)} (${paid.length} employé${paid.length > 1 ? "s" : ""})`,
        type: "success",
      }),
    );
  }

  if (totalCharges > 0) {
    dispatch(
      pushNotification({
        message: `Charges fixes payées : ${formatPrice(totalCharges)}`,
        type: "info",
      }),
    );
  }

  if (totalRevenue > 0) {
    dispatch(
      pushNotification({
        message: `Revenu produits : +${formatPrice(totalRevenue)}`,
        type: "success",
      }),
    );
  }
};

export const processMoraleTick = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  for (const emp of state.employe.employeList) {
    if (emp.id === 1) continue; // le fondateur ne démissionne pas
    if (emp.morale >= RESIGNATION_MORALE_THRESHOLD) continue;
    if (Math.random() < RESIGNATION_CHANCE_PER_TICK) {
      dispatch(resignEmploye(emp.id));
      dispatch(
        pushNotification({
          message: `${emp.firstName} ${emp.lastName} a démissionné (moral trop bas).`,
          type: "warning",
        }),
      );
    }
  }
};
