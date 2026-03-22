
/* hooks.d.ts */
type State<S> = {
  value: S;
  hookIndex: number;
  component: any;
};

export function useState<S>(initialState: S): State<S>;
export function useEffect(effect: () => void, deps: State<any>[]): void;
export function useRef<T>(initialValue: T): { current: T };
export function useMemo<T>(factory: () => T, deps: State<any>[]): T;
export function useCallback(callback: () => void, deps: State<any>[]): () => void;

/* components.d.ts */
type GenericProps = Record<string, any>;

type JsmComponent<P extends GenericProps> = {
  props: P;
  hooks: any[];
  hookIndex: number;
  renderEffects: Set<number>; // set of hook indices ( run effects every render )
  oneTimeEffects: Set<number>; // set of hook indices ( run effects only on first render )
  render: () => JsmNode<any>;
  update: () => Promise<void>;
  node: JsmNode<P> | null;
}

export type JsmNode<P extends GenericProps> = string | number | boolean | null | {
  nodeType: string | JsmComponent<P>;
  props: P;
  __node: true;
  instance?: JsmComponent<P>; // for old instances
};

type JsmComponentFn<P extends GenericProps> = {
  (props: P, ...children: JsmNode<any>[]): JsmNode<P>;
  (...children: JsmNode<any>[]): JsmNode<P>;
  (): JsmNode<P>;
}

export function Jsm<P extends GenericProps>(componentFn: (props: P) => JsmNode<P>): JsmComponentFn<P>;

/* render.d.ts */
export function render<P extends GenericProps>(node: JsmNode<P>, container: HTMLElement): void;

/* elements.d.ts */

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