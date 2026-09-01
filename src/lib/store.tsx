"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { User, Order, Toast, ToastType } from "@/types";
import { generateId } from "./utils";

// ─── Discord Session ────────────────────────────────────────────
export interface DiscordSession {
  id: string;
  username: string;
  avatarUrl: string;
}

// ─── State Shape ────────────────────────────────────────────────
interface AppState {
  user: User;
  orders: Order[];
  completedOffers: string[];
  toasts: Toast[];
  discordSession: DiscordSession | null;
  sessionLoading: boolean;
}

const GUEST_USER: User = {
  id: "guest",
  points: 0,
  username: "Guest",
  createdAt: new Date().toISOString(),
};

const INITIAL_STATE: AppState = {
  user: GUEST_USER,
  orders: [],
  completedOffers: [],
  toasts: [],
  discordSession: null,
  sessionLoading: true,
};

// ─── Actions ────────────────────────────────────────────────────
type Action =
  | { type: "ADD_TOAST"; payload: Toast }
  | { type: "REMOVE_TOAST"; payload: string }
  | {
      type: "INIT";
      payload: {
        session: DiscordSession | null;
        points: number;
        completedOffers: string[];
        orders: Order[];
      };
    }
  | { type: "SET_POINTS"; payload: number }
  | { type: "COMPLETE_OFFER"; payload: { offerId: string; points: number } }
  | { type: "ADD_ORDER"; payload: { order: Order; points: number } };

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "INIT": {
      const { session, points, completedOffers, orders } = action.payload;
      return {
        ...state,
        discordSession: session,
        sessionLoading: false,
        completedOffers,
        orders,
        user: session
          ? {
              id: session.id,
              discordId: session.id,
              username: session.username,
              points,
              createdAt: state.user.createdAt,
            }
          : GUEST_USER,
      };
    }
    case "SET_POINTS":
      return { ...state, user: { ...state.user, points: action.payload } };
    case "COMPLETE_OFFER":
      return {
        ...state,
        user: { ...state.user, points: action.payload.points },
        completedOffers: [...state.completedOffers, action.payload.offerId],
      };
    case "ADD_ORDER":
      return {
        ...state,
        user: { ...state.user, points: action.payload.points },
        orders: [action.payload.order, ...state.orders],
      };
    case "ADD_TOAST":
      return { ...state, toasts: [...state.toasts, action.payload] };
    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };
    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────
interface AppContextValue {
  state: AppState;
  session: DiscordSession | null;
  sessionLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  redeemReward: (
    rewardId: string,
    rewardName: string,
    rewardImage: string,
    pointsCost: number
  ) => Promise<boolean>;
  completeOffer: (offerId: string, points: number) => Promise<void>;
  showToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = generateId();
    dispatch({ type: "ADD_TOAST", payload: { id, message, type } });
    setTimeout(() => {
      dispatch({ type: "REMOVE_TOAST", payload: id });
    }, 4000);
  }, []);

  // On load, find out who's signed in (if anyone) and pull their real,
  // server-side points/offers/orders — this replaces localStorage as
  // the source of truth, so progress belongs to the Discord account,
  // not the browser.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [sessionRes, dataRes] = await Promise.all([
          fetch("/api/auth/session").then((r) => r.json()),
          fetch("/api/user/me").then((r) => r.json()),
        ]);

        if (cancelled) return;

        dispatch({
          type: "INIT",
          payload: {
            session: sessionRes.user ?? null,
            points: dataRes.points ?? 0,
            completedOffers: dataRes.completedOffers ?? [],
            orders: dataRes.orders ?? [],
          },
        });
      } catch {
        if (!cancelled) {
          dispatch({
            type: "INIT",
            payload: { session: null, points: 0, completedOffers: [], orders: [] },
          });
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    window.location.href = "/api/auth/discord/login";
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }, []);

  const completeOffer = useCallback(
    async (offerId: string, points: number) => {
      try {
        const res = await fetch("/api/offers/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offerId, points }),
        });

        if (res.status === 401) {
          showToast("Please sign in with Discord first.", "error");
          return;
        }

        const data = await res.json();

        if (data.alreadyCompleted) {
          showToast("You have already completed this offer.", "info");
          return;
        }

        dispatch({ type: "COMPLETE_OFFER", payload: { offerId, points: data.points } });
        showToast(`+${points} points earned!`, "success");
      } catch {
        showToast("Something went wrong saving your progress. Try again.", "error");
      }
    },
    [showToast]
  );

  const redeemReward = useCallback(
    async (
      rewardId: string,
      rewardName: string,
      rewardImage: string,
      pointsCost: number
    ): Promise<boolean> => {
      try {
        const res = await fetch("/api/rewards/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rewardId, rewardName, rewardImage, points: pointsCost }),
        });

        if (res.status === 401) {
          showToast("Please sign in with Discord first.", "error");
          return false;
        }

        const data = await res.json();

        if (!data.success) {
          showToast(
            `Insufficient points. You need ${pointsCost} points but only have ${data.points}.`,
            "error"
          );
          return false;
        }

        dispatch({ type: "ADD_ORDER", payload: { order: data.order, points: data.points } });
        showToast(`Successfully redeemed ${rewardName}!`, "success");
        return true;
      } catch {
        showToast("Something went wrong redeeming that. Try again.", "error");
        return false;
      }
    },
    [showToast]
  );

  const removeToast = useCallback((id: string) => {
    dispatch({ type: "REMOVE_TOAST", payload: id });
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        session: state.discordSession,
        sessionLoading: state.sessionLoading,
        login,
        logout,
        completeOffer,
        redeemReward,
        showToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
