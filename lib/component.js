import { getCurrentComponent, batchUpdate } from "./hooks.js";

export function JsmProps(args) {
  let props = {};
  if ( args.length == 0 || args === undefined ) return props;
  if ( args.length > 1 ) {
    const [first, ...rest] = args;
    if ( typeof first === 'object' && first.__node === undefined && !Array.isArray(first) ) {
      const flattenedChildren = rest.flat(Infinity);
      props = {...first, children: flattenedChildren};
      return props;
    }
  }
  const arg = args[0];
  if ( typeof arg === 'object' && arg.__node === undefined && !Array.isArray(arg) ) {
    return {...arg};
  } else {
    const flattenedChildren = [args].flat(Infinity);
    return {children: flattenedChildren};
  }
}

function node(type, props) {
  return {nodeType: type, props, __node: true};
}

export function Jsm(componentFn) {
  return function(...args) {
    const props = JsmProps(args);
    return node(componentFn, props);
  }
}

export function JsmDom(tag, ...args) {
  const props = JsmProps(args);
  // wrap event handlers in batchUpdate
  for ( const [key, value] of Object.entries(props) ) {
    if ( key.startsWith('on') && typeof value === 'function' ) {
      const currentComponent = getCurrentComponent();
      const wrappedHandler = (e) => batchUpdate(currentComponent, () => value(e));
      props[key] = wrappedHandler;
    }
  }
  return node(tag, props);
}