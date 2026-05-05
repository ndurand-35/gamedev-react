import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export type NotificationType = "success" | "warning" | "error" | "info";

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  createdAt: number;
}

export interface NotificationState {
  list: Notification[];
}

const initialState: NotificationState = { list: [] };

let nextLocalId = 1;

export const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    pushNotification(
      state,
      action: PayloadAction<{ message: string; type?: NotificationType }>,
    ) {
      const { message, type = "info" } = action.payload;
      state.list.push({
        id: `n_${Date.now()}_${nextLocalId++}`,
        message,
        type,
        createdAt: Date.now(),
      });
      if (state.list.length > 30) state.list.shift();
    },
    dismissNotification(state, action: PayloadAction<string>) {
      state.list = state.list.filter((n) => n.id !== action.payload);
    },
    clearNotifications(state) {
      state.list = [];
    },
  },
});

export const {
  pushNotification,
  dismissNotification,
  clearNotifications,
} = notificationSlice.actions;

export default notificationSlice.reducer;
