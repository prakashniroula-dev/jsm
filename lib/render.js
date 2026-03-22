/* 

Working types

JsmNode :
  string
  | number
  | boolean
  | null
  | {
    type: string | function => component,
    props: record<string, any>
    _instance?: JsmComponent | null
  }

JsmComponent : {
  __component: true
  props: record<string, any>,
  hooks: array<any>,
  hookIndex: number,
  renderEffects: Set<number>,
  oneTimeEffects: Set<number>,
  node: JsmNode | null,
  domNode: HTMLElement | null,
  renderTree: JsmNode | null,
  isMounted: boolean,
  onMount: function,
  onUnmount: function,
  style: function,
  update: function => {[ hookIndex = 0; rerender(); ]},
  render: function => JsmNode
}

*/

import { popHooksContext, pushHooksContext } from "./hooks.js";

function unmountNode(node) {
  if ( node === null || node === undefined ) return;
  if ( typeof node === "string" || typeof node === "number" || typeof node === "boolean" ) return;
  if ( typeof node.nodeType === "function" ) {
    const instance = node._instance;
    if ( instance ) {
      instance.onUnmount();
      if ( instance.renderTree ) unmountNode(instance.renderTree);
    }
  } else if ( typeof node.nodeType === "string" ) {
    if ( node.props && node.props.children ) {
      const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
      children.forEach(child => unmountNode(child));
    }
  }
}

function updateComponentNode(domNode, oldNode, newNode) {
  const instance = oldNode._instance;
  newNode._instance = instance;
  instance.props = newNode.props;

  // Reset the hook index before rendering
  instance.hookIndex = 0;

  const oldTree = instance.renderTree;
  const newTree = instance.render();
  const parentNode = domNode.parentNode;

  const index = Array.from(parentNode.childNodes).indexOf(domNode);
  const newDomNode = updateNode(parentNode, oldTree, newTree, index);

  instance.renderTree = newTree;
  instance.domNode = newDomNode;

  return newDomNode;
}

function updateDomChildren(domNode, oldChildren, newChildren) {
  oldChildren = oldChildren || [];
  oldChildren = oldChildren.filter(child => child !== null && child !== undefined);

  if ( newChildren === undefined || newChildren === null ) {
    // remove all old children
    oldChildren.forEach(child => {
      unmountNode(child);
      const childDomNode = domNode.childNodes[0];
      if ( childDomNode ) domNode.removeChild(childDomNode);
    });
    return;
  }

  newChildren = newChildren.filter(child => child !== null && child !== undefined);

  const maxLength = Math.max(oldChildren.length, newChildren.length);
  for ( let i = 0; i < maxLength; i++ ) {
    const oldChild = oldChildren[i] || null;
    const newChild = newChildren[i] || null;
    if ( oldChild === newChild ) continue;
    const newDom = updateNode(domNode, oldChild, newChild, i);
    if ( typeof newChild === "object" && newChild && newChild.__component ) {
      newChild.domNode = newDom;
    }
  }
}

// DOM node update function
function updateDomNode(domNode, oldNode, newNode) {
  // should be directly set
  const properties = new Set(
    ['value', 'checked', 'selected', 'disabled', 'readOnly']
  )
  
  // remove old props that don't exist in new props
  for ( const [key, value] of Object.entries(oldNode.props) ) {
    if ( key === "children" || key in newNode.props ) continue;
    if ( properties.has(key) ) {
      if (key === 'checked') {
        domNode.checked = false;
      } else if (key === 'value') {
        domNode.value = '';
      } else {
        domNode[key] = null;
      }
    } else if ( key.startsWith("on") && typeof value === "function" ) {
      const eventType = key.slice(2).toLowerCase();
      domNode.removeEventListener(eventType, value);
    } else if ( key === "style" && typeof value === "object" ) {
      domNode.style = {};
    } else {
      domNode.removeAttribute(key);
    }
  }

  // set or update props
  for ( const [key, value] of Object.entries(newNode.props) ) {
    if ( key === "children" ) continue;
    if ( properties.has(key) ) {
      domNode[key] = value;
    } else if ( key.startsWith("on") && typeof value === "function" ) {
      const eventType = key.slice(2).toLowerCase();
      if ( key in oldNode.props ) {
        domNode.removeEventListener(eventType, oldNode.props[key]);
      }
      domNode.addEventListener(eventType, value);
    } else if ( key === "style" && typeof value === "object" ) {
      Object.assign(domNode.style, value);
    } else {
      domNode.setAttribute(key, value);
    }
  }

  if ( oldNode.props.children === newNode.props.children ) return;

  updateDomChildren(domNode, oldNode.props.children, newNode.props.children);
}

// Generic function to update a single JsmNode in the DOM
function updateNode(parentNode, oldNode, newNode, index) {
  const currentDomNode = parentNode.childNodes[index] || null;


  // if old node doesn't exist, create new one
  if ( !oldNode ) {
    const newDomNode = renderNode(newNode);
    // insert at correct position
    if ( index < parentNode.childNodes.length ) {
      parentNode.insertBefore(newDomNode, currentDomNode);
    } else {
      parentNode.appendChild(newDomNode);
    }
    return newDomNode;
  }

  // if new node doesn't exist, remove old one
  if ( !newNode ) {
    unmountNode(oldNode);
    if ( currentDomNode ) parentNode.removeChild(currentDomNode);
    return null;
  }

  const isOldPrimitive =
    typeof oldNode === "string" ||
    typeof oldNode === "number" ||
    typeof oldNode === "boolean";

  const isNewPrimitive =
    typeof newNode === "string" ||
    typeof newNode === "number" ||
    typeof newNode === "boolean"

  // if both nodes are primitive, update text content
  if ( isOldPrimitive && isNewPrimitive ) {
    if ( oldNode !== newNode && currentDomNode ) {
      currentDomNode.nodeValue = newNode;
    }
    return currentDomNode;
  }

  if ( isOldPrimitive !== isNewPrimitive || (oldNode.nodeType !== newNode.nodeType) ) {
    const newDomNode = renderNode(newNode);
    unmountNode(oldNode);
    if ( currentDomNode ) parentNode.replaceChild(newDomNode, currentDomNode);
    return newDomNode;
  }

  if ( typeof newNode.nodeType === "string" ) {
    // DOM node update
    updateDomNode(currentDomNode, oldNode, newNode);
    return currentDomNode;
  }

  if ( typeof newNode.nodeType === "function" ) {
    return updateComponentNode(currentDomNode, oldNode, newNode);
  }
  throw new Error("Invalid node type:", newNode, newNode.nodeType, typeof newNode.nodeType);
  return null;
}

// re-render a JsmComponent instance
function rerenderJsm(instance) {
  const oldNode = instance.node;
  const newNode = {
    nodeType: instance.node.nodeType,
    props: instance.props,
    _instance: instance
  };
  
  // parent node is the parent of the current DOM node 
  const parentNode = instance.domNode.parentNode;
  const index = Array.from(parentNode.childNodes).indexOf(instance.domNode);

  // use the generic updateNode to update DOM node based on new JsmNode
  const newDomNode = updateNode(parentNode, oldNode, newNode, index);

  // if the DOM node has changed, update the instance's domNode reference
  if ( newDomNode !== instance.domNode ) {
    instance.domNode = newDomNode;
  }

  // update the node reference of component instance
  instance.node = newNode;
}

// render a JsmNode to a DOM node
function renderNode(node) {
  
  const isPrimitive =
    typeof node === "string" ||
    typeof node === "number" ||
    typeof node === "boolean" ||
    node === null;
  
  const isDOMNode = typeof node.nodeType === "string";
  const isComponentNode = typeof node.nodeType === "function";

  if ( isPrimitive )
    return document.createTextNode(node);

  if ( isDOMNode ) {
    const domNode = document.createElement(node.nodeType);
    const directProperties = new Set(['value', 'checked', 'selected', 'disabled', 'readOnly']);

    for ( const [key, value] of Object.entries(node.props) ) {
      if ( key === "children" ) {
        if ( Array.isArray(value) ) {
          value.forEach(child => {
            const childDomNode = renderNode(child);
            if ( childDomNode ) domNode.appendChild(childDomNode);
          });
        } else {
          const childDomNode = renderNode(value);
          if ( childDomNode ) domNode.appendChild(childDomNode);
        }
      } else if ( key.startsWith("on") && typeof value === "function" ) {
        const eventType = key.slice(2).toLowerCase();
        domNode.addEventListener(eventType, value);
      } else if ( key === "style" && typeof value === "object" ) {
        Object.assign(domNode.style, value);
      } else if ( directProperties.has(key) ) {
        domNode[key] = value;
      } else {
        domNode.setAttribute(key, value);
      }
    }
    return domNode;
  }

  if (!isComponentNode) {
    throw new Error("Invalid node type:", node, node.nodeType, typeof node.nodeType);
    return null;
  }

  
  let instance = node._instance;
  let isFirstRender = instance === undefined || instance === null;
  if (!instance) {
    // First mount: create instance object
    instance = {
      __component: true,
      props: node.props,
      hooks: [],
      hookIndex: 0,
      renderEffects: new Set(),
      oneTimeEffects: new Set(),
      node: node,
      domNode: null,
      renderTree: null,
      isMounted: false,
      onMount() {},
      onUnmount() {
        delete node._instance;
        this.domNode = null;
        this.renderTree = null;
        this.isMounted = false;
        delete this.hooks;
        this.hooks = [];
        this.hookIndex = 0;
        this.renderEffects.clear();
        this.oneTimeEffects.clear();
      },
      style: () => null,
      render() {
        pushHooksContext(this);
        const result = node.nodeType(this.props, this.style);
        popHooksContext();
        return result;
      },
      async update() {
        this.hookIndex = 0;
        rerenderJsm(this);
        this.renderEffects.forEach(effectIndex => {
          const effect = this.hooks[effectIndex];
          if ( effect.cleanup ) effect.cleanup();
          const cleanup = effect.effect();
          effect.cleanup = typeof cleanup === "function" ? cleanup : null;
        });
      }
    };
    node._instance = instance;
    instance.node = node;
  } else {
    // Update: just update props and node reference
    instance.props = node.props;
    instance.node = node;
  }

  node._instance = instance;

  const renderTree = instance.render();
  const domNode = renderNode(renderTree);

  instance.domNode = domNode;
  instance.renderTree = renderTree;

  instance.isMounted = true;
  instance.onMount();

  if (isFirstRender && instance.oneTimeEffects.size > 0) {
    instance.oneTimeEffects.forEach(effectIndex => {
      const effect = instance.hooks[effectIndex];
      effect.effect();
    });
  }

  return domNode;
}

export function render(node, container) {
  // clear container
  container.innerHTML = "";
  // render node
  const domNode = renderNode(node);
  if (domNode) container.appendChild(domNode);
}
