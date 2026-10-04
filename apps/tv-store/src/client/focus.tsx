import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEventHandler,
  type ReactNode,
  type RefCallback,
} from "react";

interface FocusTarget {
  readonly id: string;
  readonly row: number;
  readonly column: number;
  readonly element: HTMLElement;
}
interface FocusContextValue {
  register(target: FocusTarget): () => void;
  focus(id: string): void;
  activeId: string | null;
}
const FocusContext = createContext<FocusContextValue | null>(null);

export function TvFocusProvider({
  children,
  initialFocus,
  onBack,
}: {
  readonly children: ReactNode;
  readonly initialFocus: string;
  readonly onBack: () => void;
}) {
  const targets = useRef(new Map<string, FocusTarget>());
  const [activeId, setActiveId] = useState<string | null>(initialFocus);
  const focus = useCallback((id: string) => {
    const target = targets.current.get(id);
    if (target !== undefined) {
      target.element.focus();
      setActiveId(id);
    }
  }, []);
  const register = useCallback(
    (target: FocusTarget) => {
      targets.current.set(target.id, target);
      if (target.id === activeId) queueMicrotask(() => target.element.focus());
      return () => targets.current.delete(target.id);
    },
    [activeId],
  );
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" ||
        event.key === "Backspace" ||
        event.keyCode === 461
      ) {
        event.preventDefault();
        onBack();
        return;
      }
      if (!event.key.startsWith("Arrow")) return;
      const current =
        activeId === null ? undefined : targets.current.get(activeId);
      if (current === undefined) return;
      const values = [...targets.current.values()];
      const candidates = values.filter((candidate) => {
        if (event.key === "ArrowRight")
          return (
            candidate.row === current.row && candidate.column > current.column
          );
        if (event.key === "ArrowLeft")
          return (
            candidate.row === current.row && candidate.column < current.column
          );
        if (event.key === "ArrowDown") return candidate.row > current.row;
        return candidate.row < current.row;
      });
      candidates.sort((a, b) => {
        const aPrimary =
          event.key === "ArrowDown" || event.key === "ArrowUp"
            ? Math.abs(a.row - current.row)
            : Math.abs(a.column - current.column);
        const bPrimary =
          event.key === "ArrowDown" || event.key === "ArrowUp"
            ? Math.abs(b.row - current.row)
            : Math.abs(b.column - current.column);
        const aSecondary =
          Math.abs(a.column - current.column) + Math.abs(a.row - current.row);
        const bSecondary =
          Math.abs(b.column - current.column) + Math.abs(b.row - current.row);
        return aPrimary - bPrimary || aSecondary - bSecondary;
      });
      const next = candidates[0];
      if (next !== undefined) {
        event.preventDefault();
        focus(next.id);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [activeId, focus, onBack]);
  const value = useMemo(
    () => ({ register, focus, activeId }),
    [register, focus, activeId],
  );
  return (
    <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
  );
}

export function useTvFocusTarget(
  id: string,
  row: number,
  column: number,
): {
  readonly ref: RefCallback<HTMLElement>;
  readonly tabIndex: number;
  readonly onFocus: FocusEventHandler<HTMLElement>;
  readonly "data-focus-id": string;
} {
  const context = useContext(FocusContext);
  if (context === null)
    throw new Error("TV focus target requires TvFocusProvider.");
  const cleanup = useRef<(() => void) | null>(null);
  const ref = useCallback<RefCallback<HTMLElement>>(
    (element) => {
      cleanup.current?.();
      cleanup.current =
        element === null
          ? null
          : context.register({ id, row, column, element });
    },
    [context, id, row, column],
  );
  useEffect(() => () => cleanup.current?.(), []);
  return {
    ref,
    tabIndex: context.activeId === id ? 0 : -1,
    onFocus: () => context.focus(id),
    "data-focus-id": id,
  };
}
