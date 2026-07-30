import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { getUnits, setUnits as persistUnits, type Units } from "./localConfig";

interface UnitsContextValue {
  units: Units;
  toggleUnits: () => void;
  setUnits: (u: Units) => void;
}

const UnitsContext = createContext<UnitsContextValue | null>(null);

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [units, setUnitsState] = useState<Units>(getUnits());

  const setUnits = useCallback((u: Units) => {
    persistUnits(u);
    setUnitsState(u);
  }, []);

  const toggleUnits = useCallback(() => {
    setUnits(units === "km" ? "mi" : "km");
  }, [units, setUnits]);

  return <UnitsContext.Provider value={{ units, toggleUnits, setUnits }}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitsContextValue {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used within a UnitsProvider");
  return ctx;
}
