import { GenericProps, JsmNode } from "./component";

export function render<P extends GenericProps>(node: JsmNode<P>, container: HTMLElement): void;