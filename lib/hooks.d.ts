
type State<S> = {
  value: S;
  hookIndex: number;
  component: any;
};

export function pushHooksContext(component: any): void;
export function popHooksContext(): void;

export function useState<S>(initialState: S): State<S>;
export function useEffect(effect: () => void, deps: State<any>[]): void;
export function useRef<T>(initialValue: T): { current: T };
export function useMemo<T>(factory: () => T, deps: State<any>[]): T;
export function useCallback(callback: () => void, deps: State<any>[]): () => void;
export function batchUpdate(instance: any, fn: () => void): void;
export function getCurrentComponent(): any;