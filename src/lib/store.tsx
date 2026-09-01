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

const DEFAULT_USER: User = {
  id: "demo-user",
  points: 150,
  username: "DemoUser",
  createdAt: new Date().toISOString(),
};

const INITIAL_STATE: AppState = {
  user: DEFAULT_USER,
  orders: [],
  completedOffers: [],
  toasts: [],
  discordSession: null,
  sessionLoading: true,
};

// ─── Actions ────────────────────────────────────────────────────
type Action =
  | { type: "SET_STATE"; payload: Partial<AppState> }
  | { type: "ADD_POINTS"; payload: number }
  | { type: "DEDUCT_POINTS"; payload: number }
  | { type: "ADD_ORDER"; payload: Order }
  | { type: "COMPLETE_OFFER"; payload: { offerId: string; points: number } }
  | { type: "ADD_TOAST"; payload: Toast }
  | { type: "REMOVE_TOAST"; payload: string }
  | { type: "SET_SESSION"; payload: DiscordSession | null };

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_STATE":
      return { ...state, ...action.payload };
    case "ADD_POINTS":
      return {
        ...state,
        user: { ...state.user, points: state.user.points + action.payload },
      };
    case "DEDUCT_POINTS":
      return {
        ...state,
        user: { ...state.user, points: state.user.points - action.payload },
      };
    case "ADD_ORDER":
      return {
        ...state,
        orders: [action.payload, ...state.orders],
      };
    case "COMPLETE_OFFER":
      return {
        ...state,
        user: {
          ...state.user,
          points: state.user.points + action.payload.points,
        },
        completedOffers: [
          ...state.completedOffers,
          action.payload.offerId,
        ],
      };
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [...state.toasts, action.payload],
      };
    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };
    case "SET_SESSION":
      return {
        ...state,
        discordSession: action.payload,
        sessionLoading: false,
        user: action.payload
          ? {
              ...state.user,
              discordId: action.payload.id,
              username: action.payload.username,
            }
          : state.user,
      };
    default:
      return state;
  }
}

// ─── Storage ────────────────────────────────────────────────────
const STORAGE_KEY = "capeverse-state";

function loadState(): Partial<AppState> | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...parsed, toasts: [] };
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    const { toasts, discordSession, sessionLoading, ...persistable } = state;
    void toasts;
    void discordSession;
    void sessionLoading;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch {
    // ignore storage errors
  }
}

// ─── Context ────────────────────────────────────────────────────
interface AppContextValue {
  state: AppState;
  session: DiscordSession | null;
  sessionLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  addPoints: (points: number) => void;
  redeemReward: (
    rewardId: string,
    rewardName: string,
    rewardImage: string,
    pointsCost: number
  ) => boolean;
  completeOffer: (offerId: string, points: number) => void;
  showToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydrate points/orders from localStorage on mount
  useEffect(() => {
    const saved = loadState();
    if (saved) {
      dispatch({ type: "SET_STATE", payload: saved });
    }
    setHydrated(true);
  }, []);

  // Persist points/orders to localStorage on state change
  useEffect(() => {
    if (hydrated) {
      saveState(state);
    }
  }, [state, hydrated]);

  // Check whether the visitor has a linked Discord session
  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          dispatch({ type: "SET_SESSION", payload: data.user ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          dispatch({ type: "SET_SESSION", payload: null });
        }
      });

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
      dispatch({ type: "SET_SESSION", payload: null });
      window.location.href = "/";
    }
  }, []);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = generateId();
    dispatch({ type: "ADD_TOAST", payload: { id, message, type } });
    setTimeout(() => {
      dispatch({ type: "REMOVE_TOAST", payload: id });
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    dispatch({ type: "REMOVE_TOAST", payload: id });
  }, []);

  const addPoints = useCallback(
    (points: number) => {
      dispatch({ type: "ADD_POINTS", payload: points });
      showToast(`+${points} points earned!`, "success");
    },
    [showToast]
  );

  const redeemReward = useCallback(
    (
      rewardId: string,
      rewardName: string,
      rewardImage: string,
      pointsCost: number
    ): boolean => {
      if (state.user.points < pointsCost) {
        showToast(
          `Insufficient points. You need ${pointsCost} points but only have ${state.user.points}.`,
          "error"
        );
        return false;
      }

      dispatch({ type: "DEDUCT_POINTS", payload: pointsCost });

      const order: Order = {
        id: generateId(),
        rewardId,
        rewardName,
        rewardImage,
        points: pointsCost,
        status: "COMPLETED",
        createdAt: new Date().toISOString(),
      };

      dispatch({ type: "ADD_ORDER", payload: order });
      showToast(`Successfully redeemed ${rewardName}!`, "success");
      return true;
    },
    [state.user.points, showToast]
  );

  const completeOffer = useCallback(
    (offerId: string, points: number) => {
      if (state.completedOffers.includes(offerId)) {
        showToast("You have already completed this offer.", "info");
        return;
      }
      dispatch({ type: "COMPLETE_OFFER", payload: { offerId, points } });
      showToast(`Task completed! +${points} points earned.`, "success");
    },
    [state.completedOffers, showToast]
  );

  if (!hydrated) {
    return null;
  }

  return (
    <AppContext.Provider
      value={{
        state,
        session: state.discordSession,
        sessionLoading: state.sessionLoading,
        login,
        logout,
        addPoints,
        redeemReward,
        completeOffer,
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
