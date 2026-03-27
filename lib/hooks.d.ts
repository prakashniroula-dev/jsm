
type State<S> = {
  value: S;
  hookIndex: number;
  component: any;
};

export function pushHooksContext(component: any): void;
export function popHooksContext(): void;

/**
 * useState creates or retrieves reactive state.
 * Must be called during component render (not conditionally).
 * @throws {Error} if called outside component context or if hook count changes across renders
 */
export function useState<S>(initialState: S): State<S>;
/**
 * useEffect runs side effects and registers cleanup functions.
 * Must be called during component render (not conditionally).
 * @throws {Error} if called outside component context or if hook count changes across renders
 */
export function useEffect(effect: () => void, deps: State<any>[]): void;

/**
 * useRef creates a mutable reference that persists across renders.
 * Must be called during component render (not conditionally).
 * @throws {Error} if called outside component context or if hook count changes across renders
 */
export function useRef<T>(initialValue: T): { current: T };

/**
 * useMemo memoizes computed values and invalidates when deps change.
 * Must be called during component render (not conditionally).
 * @throws {Error} if called outside component context or if hook count changes across renders
 */
export function useMemo<T>(factory: () => T, deps: State<any>[]): T;
export function useCallback(callback: () => void, deps: State<any>[]): () => void;
export function batchUpdate(instance: any, fn: () => void): void;
export function getCurrentComponent(): any;