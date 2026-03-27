// JsmNode: primitive | {type, props, _instance}
// JsmComponent: {hooks[], hookIndex, renderEffects Set, oneTimeEffects Set, ...state}

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
      const children = node.props.children;
      children.forEach(child => unmountNode(child));
    }
    const domNode = node._domNode;
    if ( domNode ) {
      const listeners = [];
      for ( const [key, value] of Object.entries(node.props) ) {
        if ( key.startsWith("on") && typeof value === "function" ) {
          listeners.push({eventType: key.slice(2).toLowerCase(), handler: value});
        }
      }
      listeners.forEach(({eventType, handler}) => {
        domNode.removeEventListener(eventType, handler);
      });
    }
  }
}

function updateComponentNode(domNode, oldNode, newNode) {
  const instance = oldNode._instance;
  newNode._instance = instance;
  instance.props = newNode.props;

  instance.hookIndex = 0;

  const oldTree = instance.renderTree;
  const newTree = instance.render();
  const parentNode = domNode.parentNode;
  if (!parentNode) {
    throw new Error("Cannot update component: node is detached from DOM");
  }

  const index = Array.from(parentNode.childNodes).indexOf(domNode);
  const newDomNode = updateNode(parentNode, oldTree, newTree, index);

  instance.renderTree = newTree;
  instance.domNode = newDomNode;

  return newDomNode;
}

function getNodeKey(node) {
  if ( typeof node === "object" && node !== null && node.props && node.props.key !== undefined ) {
    return node.props.key;
  }
  return null;
}

function updateDomChildren(domNode, oldChildren, newChildren) {
  oldChildren = oldChildren || [];
  oldChildren = oldChildren.filter(child => child !== null && child !== undefined);

  if ( newChildren === undefined || newChildren === null ) {
    oldChildren.forEach(child => {
      unmountNode(child);
      const childDomNode = domNode.childNodes[0];
      if ( childDomNode ) domNode.removeChild(childDomNode);
    });
    return;
  }

  newChildren = newChildren.filter(child => child !== null && child !== undefined);

  const hasKeys = oldChildren.some(c => getNodeKey(c) !== null) || newChildren.some(c => getNodeKey(c) !== null);

  if ( !hasKeys ) {
    // index-based: no key tracking
    const oldLength = oldChildren.length;
    const newLength = newChildren.length;
    const minLength = Math.min(oldLength, newLength);
    for ( let i = 0; i < minLength; i++ ) {
      const oldChild = oldChildren[i];
      const newChild = newChildren[i];
      if ( oldChild === newChild ) continue;
      const newDom = updateNode(domNode, oldChild, newChild, i);
      if ( typeof newChild === "object" && newChild && newChild.__component ) {
        newChild.domNode = newDom;
      }
    }

    if ( newLength > oldLength ) {
      for ( let i = oldLength; i < newLength; i++ ) {
        const newChild = newChildren[i];
        const newDom = updateNode(domNode, null, newChild, i);
        if ( typeof newChild === "object" && newChild && newChild.__component ) {
          newChild.domNode = newDom;
        }
      }
    }

    if ( oldLength > newLength ) {
      for ( let i = oldLength - 1; i >= newLength; i-- ) {
        const oldChild = oldChildren[i];
        unmountNode(oldChild);
        const childDomNode = domNode.childNodes[i];
        if ( childDomNode ) domNode.removeChild(childDomNode);
      }
    }
    return;
  }

  // key-based: match by key, fall back to index for keyless children
  const oldChildrenMap = new Map();
  oldChildren.forEach((child, index) => {
    const key = getNodeKey(child);
    if ( key !== null ) {
      oldChildrenMap.set(key, {child, index, domNode: domNode.childNodes[index]});
    } else {
      oldChildrenMap.set(`__index_${index}`, {child, index, domNode: domNode.childNodes[index]});
    }
  });

  const usedIndices = new Set();
  const newDomNodeList = [];
  newChildren.forEach((newChild, newIndex) => {
    const newKey = getNodeKey(newChild);
    const lookupKey = newKey !== null ? newKey : `__index_${newIndex}`;
    const oldEntry = oldChildrenMap.get(lookupKey);

    if ( oldEntry ) {
      usedIndices.add(oldEntry.index);
    }

    const oldChild = oldEntry ? oldEntry.child : null;

    if ( oldChild === newChild ) {
      newDomNodeList.push(oldEntry.domNode);
    } else {
      // find current DOM position instead of relying on old index
      if ( !oldChild ) {
        const newDom = renderNode(newChild);
        newDomNodeList.push(newDom);
      } else {
        const oldDomNode = oldEntry ? oldEntry.domNode : null;
        if ( oldDomNode ) {
          const parentNode = oldDomNode.parentNode;
          const currentIndex = Array.from(parentNode.childNodes).indexOf(oldDomNode);
          const newDom = updateNode(parentNode, oldChild, newChild, currentIndex);
          newDomNodeList.push(newDom);
        } else {
          const newDom = renderNode(newChild);
          newDomNodeList.push(newDom);
        }
      }

      if ( typeof newChild === "object" && newChild && newChild.__component ) {
        newChild.domNode = newDomNodeList[newDomNodeList.length - 1];
      }
    }
  });

  // reverse order: prevents shifting indices during removal
  for ( let i = oldChildren.length - 1; i >= 0; i-- ) {
    if ( !usedIndices.has(i) ) {
      const child = oldChildren[i];
      unmountNode(child);
      const childDomNode = domNode.childNodes[i];
      if ( childDomNode && childDomNode.parentNode === domNode ) {
        domNode.removeChild(childDomNode);
      }
    }
  }

  newDomNodeList.forEach((newDomNode, newIndex) => {
    if ( !newDomNode ) return;
    if ( newDomNode.parentNode !== domNode ) {
      domNode.appendChild(newDomNode);
    }
    const currentIndex = Array.from(domNode.childNodes).indexOf(newDomNode);
    if ( currentIndex !== newIndex ) {
      const targetNode = domNode.childNodes[newIndex];
      domNode.insertBefore(newDomNode, targetNode || null);
    }
  });
}

function updateDomNode(domNode, oldNode, newNode) {
  // direct assignment instead of setAttribute
  const properties = new Set(
    ['value', 'checked', 'selected', 'disabled', 'readOnly']
  )
  
  if ( !oldNode._eventHandlers ) oldNode._eventHandlers = {};
  if ( !newNode._eventHandlers ) newNode._eventHandlers = {};

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
      if ( key in oldNode._eventHandlers ) {
        domNode.removeEventListener(eventType, oldNode._eventHandlers[key]);
      }
    } else if ( key === "style" && typeof value === "object" ) {
      domNode.style.cssText = '';
    } else {
      domNode.removeAttribute(key);
    }
  }

  for ( const [key, value] of Object.entries(newNode.props) ) {
    if ( key === "children" ) continue;
    if ( properties.has(key) ) {
      domNode[key] = value;
    } else if ( key.startsWith("on") && typeof value === "function" ) {
      const eventType = key.slice(2).toLowerCase();
      if ( key in oldNode._eventHandlers ) {
        domNode.removeEventListener(eventType, oldNode._eventHandlers[key]);
      }
      newNode._eventHandlers[key] = value;
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

function updateNode(parentNode, oldNode, newNode, index) {
  const currentDomNode = parentNode.childNodes[index] || null;


  if ( !oldNode ) {
    const newDomNode = renderNode(newNode);
    if ( index < parentNode.childNodes.length ) {
      parentNode.insertBefore(newDomNode, currentDomNode);
    } else {
      parentNode.appendChild(newDomNode);
    }
    return newDomNode;
  }

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
    updateDomNode(currentDomNode, oldNode, newNode);
    return currentDomNode;
  }

  if ( typeof newNode.nodeType === "function" ) {
    return updateComponentNode(currentDomNode, oldNode, newNode);
  }
  throw new Error("Invalid node type:", newNode, newNode.nodeType, typeof newNode.nodeType);
  return null;
}

function rerenderJsm(instance) {
  const oldNode = instance.node;
  const newNode = {
    nodeType: instance.node.nodeType,
    props: instance.props,
    _instance: instance
  };

  const parentNode = instance.domNode.parentNode;
  if (!parentNode) {
    throw new Error("Cannot re-render component: node is detached from DOM");
  }
  const index = Array.from(parentNode.childNodes).indexOf(instance.domNode);

  const newDomNode = updateNode(parentNode, oldNode, newNode, index);

  if ( newDomNode !== instance.domNode ) {
    instance.domNode = newDomNode;
  }
  instance.node = newNode;
}

function renderNode(node) {
  
  const isPrimitive =
    typeof node === "string" ||
    typeof node === "number" ||
    typeof node === "boolean"

  if ( node === null || node === undefined ) return null;
  
  const isDOMNode = typeof node.nodeType === "string";
  const isComponentNode = typeof node.nodeType === "function";

  if ( isPrimitive )
    return document.createTextNode(node);

  if ( isDOMNode ) {
    const domNode = document.createElement(node.nodeType);
    const directProperties = new Set(['value', 'checked', 'selected', 'disabled', 'readOnly']);
    node._eventHandlers = {};

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
        node._eventHandlers[key] = value;
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
        this.domNode = null;
        this.renderTree = null;
        this.isMounted = false;
        this.renderEffects.forEach(effectIndex => {
          const effect = this.hooks[effectIndex];
          if ( effect?.cleanup ) effect.cleanup();
        });
        this.oneTimeEffects.forEach(effectIndex => {
          const effect = this.hooks[effectIndex];
          if ( effect?.cleanup ) effect.cleanup();
        });
        this.renderEffects.clear();
        this.oneTimeEffects.clear();
        this.hooks = [];
        this.hookIndex = 0;
      },
      style: () => null,
      render() {
        pushHooksContext(this);
        this.hookIndex = 0;
        const result = node.nodeType(this.props, this.style);
        popHooksContext();
        
        // Validate hook count consistency (detect conditional hooks)
        if (this._expectedHookCount !== undefined && this.hookIndex !== this._expectedHookCount) {
          throw new Error(
            `Rendered ${this.hookIndex} hooks but expected ${this._expectedHookCount}. ` +
            `Hooks must be called in the same order on every render. ` +
            `Check for conditional hook calls (hooks in if/loops).`
          );
        }
        this._expectedHookCount = this.hookIndex;
        
        return result;
      },
      update() {
        this.hookIndex = 0;
        rerenderJsm(this);
        
        // Validate hook count consistency (detect conditional hooks)
        if (this._expectedHookCount !== undefined && this.hookIndex !== this._expectedHookCount) {
          throw new Error(
            `Rendered ${this.hookIndex} hooks but expected ${this._expectedHookCount}. ` +
            `Hooks must be called in the same order on every render. ` +
            `Check for conditional hook calls (hooks in if/loops).`
          );
        }
        this._expectedHookCount = this.hookIndex;
        
        this.renderEffects.forEach(effectIndex => {
          const effect = this.hooks[effectIndex];
          if ( effect?.cleanup ) effect.cleanup();
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
