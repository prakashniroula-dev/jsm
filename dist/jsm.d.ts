
// Hooks
type State<S> = {
  value: S;
  hookIndex: number;
  component: any;
};

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

// Components
type GenericProps = Record<string, any>;

export type JsmComponent<P extends GenericProps> = {
  props: P;
  hooks: any[];
  hookIndex: number;
  renderEffects: Set<number>;
  oneTimeEffects: Set<number>;
  render: () => JsmNode<any>;
  update: () => void;
  node: JsmNode<P> | null;
  _expectedHookCount?: number;
}

export type JsmNode<P extends GenericProps & {key?: string | number}> = string | number | boolean | null | {
  __node: true,
  nodeType: string | JsmComponent<P>;
  props: P & {key?: string | number};
  instance?: JsmComponent<P>;
  _instance?: any;
  _eventHandlers?: Record<string, Function>;
};

type JsmComponentFn<P extends GenericProps> = {
  (props: P, ...children: JsmNode<any>[]): JsmNode<P>;
  (...children: JsmNode<any>[]): JsmNode<P>;
  (): JsmNode<P>;
}

type JsmDomComponent<P extends GenericProps> = {
  (tag: string, props: P, ...children: JsmNode<any>[]): JsmNode<P>;
  (tag: string, ...children: JsmNode<any>[]): JsmNode<P>;
  (tag: string): JsmNode<P>;
}

export function Jsm<P extends GenericProps>(componentFn: (props: P) => JsmNode<P>): JsmComponentFn<P>;
export const JsmDom: JsmDomComponent<GenericProps>;

// Render
export function render<P extends GenericProps>(node: JsmNode<P>, container: HTMLElement): void;

// Elements
type JsmDomNode<P extends GenericProps> = JsmComponentFn<P>;

export const Div: JsmDomNode<HTMLDivElement>;
export const Span: JsmDomNode<HTMLSpanElement>;
export const Button: JsmDomNode<HTMLButtonElement>;
export const Input: JsmDomNode<HTMLInputElement>;
export const P: JsmDomNode<HTMLParagraphElement>;
export const Link: JsmDomNode<HTMLAnchorElement>;
export const Img: JsmDomNode<HTMLImageElement>;
export const Ul: JsmDomNode<HTMLUListElement>;
export const Ol: JsmDomNode<HTMLOListElement>;
export const Li: JsmDomNode<HTMLLIElement>;
export const Section: JsmDomNode<HTMLElement>;
export const Article: JsmDomNode<HTMLElement>;
export const Header: JsmDomNode<HTMLElement>;
export const Footer: JsmDomNode<HTMLElement>;
export const Nav: JsmDomNode<HTMLElement>;
export const Main: JsmDomNode<HTMLElement>;
export const Aside: JsmDomNode<HTMLElement>;
export const Form: JsmDomNode<HTMLFormElement>;
export const Label: JsmDomNode<HTMLLabelElement>;
export const Textarea: JsmDomNode<HTMLTextAreaElement>;
export const Select: JsmDomNode<HTMLSelectElement>;
export const Option: JsmDomNode<HTMLOptionElement>;
export const H1: JsmDomNode<HTMLHeadingElement>;
export const H2: JsmDomNode<HTMLHeadingElement>;
export const H3: JsmDomNode<HTMLHeadingElement>;
export const H4: JsmDomNode<HTMLHeadingElement>;
export const H5: JsmDomNode<HTMLHeadingElement>;
export const H6: JsmDomNode<HTMLHeadingElement>;
export const H7: JsmDomNode<HTMLHeadingElement>;
export const H8: JsmDomNode<HTMLHeadingElement>;