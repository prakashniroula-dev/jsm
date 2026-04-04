
type GenericProps = Record<string, any>;

export type JsmComponent<P extends GenericProps> = {
  __component: true;
  _scope: string; // CSS scope identifier
  props: P;
  hooks: any[];
  hookIndex: number;
  renderEffects: Set<number>; // set of hook indices ( run effects every render )
  oneTimeEffects: Set<number>; // set of hook indices ( run effects only on first render )
  render: () => JsmNode<any>;
  update: () => void;  // synchronous update
  onMount?: () => void;
  onUnmount?: () => void;
  renderTree?: JsmNode<any>;
  domNode?: Node;
  node: JsmNode<P> | null;
  _expectedHookCount?: number; // validates hook count consistency across renders (detects conditional hooks)
}

export type JsmNode<P extends GenericProps & {key?: string | number}> = string | number | boolean | null | {
  __node: true,
  componentName?: string; // for debugging
  nodeType: string | JsmComponent<P>;
  props: P & {key?: string | number}; // optional key prop for list reconciliation (like React)
  instance?: JsmComponent<P>; // for old instances
  _instance?: any; // internal instance reference
  _eventHandlers?: Record<string, Function>; // stored event handler references for cleanup
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

export function Jsm<P extends GenericProps>(componentFn: (props: P) => JsmNode<P>, componentName?: string): JsmComponentFn<P>;
export const JsmDom: JsmDomComponent<GenericProps>;