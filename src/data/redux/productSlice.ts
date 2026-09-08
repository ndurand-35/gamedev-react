import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import {
  ComponentType,
  ConsumedComponent,
  Product,
  ProductStatus,
  computeMonthlyRevenue,
  isProductReady,
} from "@/data/interface";

export interface ProductState {
  products: Product[];
  nextProductId: number;
  // Compteur cumulé de produits lancés (stat de l'écran de bilan WF-3).
  productsLaunched: number;
}

const initialState: ProductState = {
  products: [],
  nextProductId: 1,
  productsLaunched: 0,
};

const blankInvested = (): Record<ComponentType, number> => ({
  [ComponentType.CODE]: 0,
  [ComponentType.VISUEL]: 0,
  [ComponentType.UX]: 0,
});

export const productSlice = createSlice({
  name: "product",
  initialState,
  reducers: {
    initializeProductState(state) {
      state.products = [];
      state.nextProductId = 1;
      state.productsLaunched = 0;
    },
    createProduct(
      state,
      action: PayloadAction<{
        name: string;
        requirements: Record<ComponentType, number>;
      }>,
    ) {
      state.products.push({
        id: state.nextProductId++,
        name: action.payload.name,
        status: ProductStatus.DEVELOPING,
        requirements: action.payload.requirements,
        invested: blankInvested(),
        qualitySum: 0,
        qualityCount: 0,
        monthlyRevenue: 0,
      });
    },
    investInProduct(
      state,
      action: PayloadAction<{
        productId: number;
        consumed: ConsumedComponent[];
      }>,
    ) {
      const p = state.products.find((p) => p.id === action.payload.productId);
      if (!p) return;
      if (p.status !== ProductStatus.DEVELOPING) return;
      for (const c of action.payload.consumed) {
        p.invested[c.type] += 1;
        p.qualitySum += c.quality;
        p.qualityCount += 1;
      }
    },
    launchProduct(state, action: PayloadAction<{ productId: number; time: number }>) {
      const p = state.products.find((p) => p.id === action.payload.productId);
      if (!p) return;
      if (!isProductReady(p)) return;
      p.status = ProductStatus.LAUNCHED;
      p.launchTime = action.payload.time;
      p.monthlyRevenue = computeMonthlyRevenue(p);
      state.productsLaunched += 1;
    },
    retireProduct(state, action: PayloadAction<number>) {
      const p = state.products.find((p) => p.id === action.payload);
      if (!p) return;
      p.status = ProductStatus.RETIRED;
      p.monthlyRevenue = 0;
    },
  },
});

export const {
  initializeProductState,
  createProduct,
  investInProduct,
  launchProduct,
  retireProduct,
} = productSlice.actions;

export default productSlice.reducer;
