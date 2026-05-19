"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AthleteData, PlannedWorkout, TargetEvent } from "./types";

interface Store {
  athleteData: AthleteData | null;
  setAthleteData: (d: AthleteData | null) => void;
  plan: PlannedWorkout[];
  setPlan: (p: PlannedWorkout[]) => void;
  targetEvents: TargetEvent[];
  setTargetEvents: (e: TargetEvent[]) => void;
}

const StoreContext = createContext<Store | null>(null);

const ATHLETE_KEY = "ic_athleteData";
const PLAN_KEY = "ic_plan";
const EVENTS_KEY = "ic_targetEvents";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [athleteData, setAthleteDataState] = useState<AthleteData | null>(null);
  const [plan, setPlanState] = useState<PlannedWorkout[]>([]);
  const [targetEvents, setTargetEventsState] = useState<TargetEvent[]>([]);

  // Rehydrate from sessionStorage so state survives page navigation/refresh.
  useEffect(() => {
    try {
      const a = sessionStorage.getItem(ATHLETE_KEY);
      if (a) setAthleteDataState(JSON.parse(a));
      const p = sessionStorage.getItem(PLAN_KEY);
      if (p) setPlanState(JSON.parse(p));
      const e = sessionStorage.getItem(EVENTS_KEY);
      if (e) setTargetEventsState(JSON.parse(e));
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const setAthleteData = (d: AthleteData | null) => {
    setAthleteDataState(d);
    try {
      if (d) sessionStorage.setItem(ATHLETE_KEY, JSON.stringify(d));
      else sessionStorage.removeItem(ATHLETE_KEY);
    } catch {
      // ignore
    }
  };

  const setPlan = (p: PlannedWorkout[]) => {
    setPlanState(p);
    try {
      sessionStorage.setItem(PLAN_KEY, JSON.stringify(p));
    } catch {
      // ignore
    }
  };

  const setTargetEvents = (e: TargetEvent[]) => {
    setTargetEventsState(e);
    try {
      sessionStorage.setItem(EVENTS_KEY, JSON.stringify(e));
    } catch {
      // ignore
    }
  };

  return (
    <StoreContext.Provider
      value={{
        athleteData,
        setAthleteData,
        plan,
        setPlan,
        targetEvents,
        setTargetEvents,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
