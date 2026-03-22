
type GenericProps = Record<string, any>;

export type JsmComponent<P extends GenericProps> = {
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
  __node: true,
  nodeType: string | JsmComponent<P>;
  props: P;
  instance?: JsmComponent<P>; // for old instances
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