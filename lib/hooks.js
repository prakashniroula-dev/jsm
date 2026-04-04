
// Hook system: stores hooks indexed by call order, tracks effects in sets

let currentComponent = null;
const hooksContext = [];

let batchingDepth = 0;
const pendingEffects = new Set();
const pendingRenders = new Set();

// CSS Scope Management
const scopedCssMap = new Map();

function injectComponentStyles(scope, hookIndex, cssText) {
  if (!cssText || typeof cssText !== 'string') return;
  
  // Prefix all selectors with the scope class to ensure styles are scoped to the component
  let scopedCss = cssText;
  
  // Replace & with the scope selector
  scopedCss = scopedCss.replace(/&/g, `.${scope}`);
  
  // Prefix all other selectors that aren't already scoped
  scopedCss = scopedCss.replace(/([^{}]+)\{/g, (match, selector) => {
    // Split by comma to handle multiple selectors
    const selectors = selector.split(',').map(sel => {
      sel = sel.trim();
      // Skip if already contains scope or is a media query/at-rule
      if (sel.includes(`.${scope}`) || sel.startsWith('@')) return sel;
      // Prefix selector with scope class
      return `.${scope} ${sel}`;
    }).join(', ');
    return selectors + '{';
  });
  
  let componentStyleMap = scopedCssMap.get(scope);

  if (!componentStyleMap) {
    componentStyleMap = new Map();
    scopedCssMap.set(scope, componentStyleMap);
  }

  let styleElement = componentStyleMap.get(hookIndex);

  if ( !styleElement ) {
    styleElement = document.createElement('style');
    styleElement.textContent = scopedCss;
    document.head.appendChild(styleElement);
    componentStyleMap.set(hookIndex, styleElement);
  }

  styleElement.textContent = scopedCss;
}

export function removeComponentStyles(scope) {
  const componentStyleMap = scopedCssMap.get(scope);
  if (componentStyleMap) {
    componentStyleMap.forEach(styleElement => styleElement.remove());
    componentStyleMap.clear();
    scopedCssMap.delete(scope);
  }
}

function pushHooksContext(component) {
  hooksContext.push(currentComponent);
  currentComponent = component;
}

function popHooksContext() {
  const component = hooksContext.pop();
  currentComponent = component;
}

function batchUpdate(fn) {
  try {
    batchingDepth++;
    fn();
  } finally {
    batchingDepth--;
    if ( batchingDepth !== 0 ) return;
    const runEffects = () => {
      pendingEffects.forEach(hook => {
        const effect = hook.effect;
        if ( effect ) effect();
      });
    }
    if ( pendingRenders.size > 0 ) {
      pendingRenders.forEach(component => component.update());
      pendingRenders.clear();
      runEffects();
    }
    pendingEffects.clear();
  }
}

function postSetState(component) {
  if ( batchingDepth > 0 ) {
    pendingRenders.add(component);
  } else {
    component.update();
  }

  // const state = component.hooks[hookIndex];
  // if ( state.effects.size > 0 ) {
  //   state.effects.forEach(effectIndex => {
  //     const hook = component.hooks[effectIndex];
  //     if ( batchingDepth > 0 ) {
  //       pendingEffects.add(hook);
  //     } else {
  //       hook.effect();
  //     }
  //   });
  // }
}

function useState(initialValue) {
  const component = currentComponent;
  if (!component) {
    throw new Error("useState: no active component");
  }
  const hookIndex = component.hookIndex++;
  
  if ( component.hooks[hookIndex] === undefined ) {
    component.hooks[hookIndex] = {value: initialValue};
  }
  
  const setter = (newValue) => {
    const oldValue = component.hooks[hookIndex].value;
    if ( newValue === oldValue ) return;
    if ( typeof newValue === 'function' ) {
      component.hooks[hookIndex].value = newValue(oldValue);
    } else {
      component.hooks[hookIndex].value = newValue;
    }
    
    // postSetState(component, hookIndex);
    postSetState(component);
  }

  const state = {
    get value() { return component.hooks[hookIndex].value; },
    set value(newValue) { setter(newValue); },
    component,
    hookIndex,
  }

  return state;
}


function subscribeEffect(index, deps) {
  if ( deps === undefined ) {
    currentComponent.renderEffects.add(index);
    return;
  }
  if ( deps.length === 0 ) {
    currentComponent.oneTimeEffects.add(index);
    return;
  }
  // if dependencies exist, run at least once
  pendingEffects.add(currentComponent.hooks[index]);
}

function unsubscribeEffect(index, deps) {
  const effect = currentComponent.hooks[index];
  if ( effect?.cleanup ) effect.cleanup();
  if ( deps === undefined ) {
    currentComponent.renderEffects.delete(index);
    return;
  }
  if ( deps.length === 0 ) {
    currentComponent.oneTimeEffects.delete(index);
    return;
  }
}

function useEffect(effectFn, deps) {
  const component = currentComponent;
  if (!component) {
    throw new Error("useEffect: no active component");
  }
  const hookIndex = component.hookIndex++;

  let hook = component.hooks[hookIndex];

  const effect = function (hook) {
    const oldCleanup = hook.cleanup;
    if ( oldCleanup ) oldCleanup();
    hook.cleanup = null;
    const cleanup = effectFn();
    if ( cleanup ) hook.cleanup = cleanup;
  }

  if ( component.hooks[hookIndex] === undefined ) {
    component.hooks[hookIndex] = {deps, cleanup: null};
    hook = component.hooks[hookIndex];
    hook.effect = () => effect(hook);
    subscribeEffect(hookIndex, deps);
    return;
  } else {
    const oldDeps = hook.deps;
    if ( oldDeps === deps ) return;
    if ( oldDeps?.length === deps?.length && oldDeps?.every((dep, i) => {
      const newDep = deps?.[i];
      const isState = newDep?.component && newDep?.hookIndex && dep?.component && dep?.hookIndex !== undefined;
      return isState ? newDep.component === dep.component && newDep.value === dep.value : Object.is(newDep, dep);
    })) return;

    unsubscribeEffect(hookIndex, component.hooks[hookIndex].deps);
    hook.effect = () => effect(hook);
    hook.deps = deps;
    subscribeEffect(hookIndex, deps);
    pendingEffects.add(hook);
  }
}

function useRef(initialValue) {
  const component = currentComponent;
  if (!component) {
    throw new Error("useRef: no active component");
  }
  const hookIndex = component.hookIndex++;
  if ( component.hooks[hookIndex] === undefined ) {
    component.hooks[hookIndex] = {current: initialValue};
  }
  return component.hooks[hookIndex];
}

function useMemo(factory, deps) {
  const component = currentComponent;
  if (!component) {
    throw new Error("useMemo: no active component");
  }
  const hookIndex = component.hookIndex++;
  const hook = component.hooks[hookIndex];

  const runFactory = () => {
    const value = factory();
    const depsValues = deps ? deps.map(dep => dep?.value) : undefined;
    component.hooks[hookIndex] = { value, deps: depsValues };
    return value;
  };

  if (deps === undefined || hook === undefined) return runFactory();
  if (deps.length === 0) return hook.value;

  const oldDeps = hook.deps;

  if (!oldDeps) return runFactory();

  const newDepsValues = deps.map(dep => dep?.value);
  if (oldDeps.length === newDepsValues.length && oldDeps.every((oldVal, i) => Object.is(oldVal, newDepsValues[i]))) {
    return hook.value;
  }

  return runFactory();
}

function useCallback(callback, deps) {
  return useMemo(() => callback, deps);
}

function useCss(cssText) {
  const component = currentComponent;
  if (!component) {
    throw new Error("useCss: no active component");
  }
  const hookIndex = component.hookIndex++;
  
  const componentCssMap = scopedCssMap.get(component._scope);
  if (!componentCssMap || !componentCssMap.has(hookIndex)) {
    injectComponentStyles(component._scope, hookIndex, cssText);
  }
}

function useDynamicCss(cssText) {
  const component = currentComponent;
  if (!component) {
    throw new Error("useDynamicCss: no active component");
  }
  const hookIndex = component.hookIndex++;
  const componentCssMap = scopedCssMap.get(component._scope);
  if (!componentCssMap || !componentCssMap.has(hookIndex)) {
    injectComponentStyles(component._scope, hookIndex, cssText);
  }
  
  useEffect(() => {
    injectComponentStyles(component._scope, hookIndex, cssText);
  }, [cssText]);
}

function batchUpdateWrapper(instance, callback) {
  pushHooksContext(instance);
  batchUpdate(callback);
  popHooksContext();
}


function getCurrentComponent() {
  return currentComponent;
}

export {
  pushHooksContext, popHooksContext, useState, useEffect, useRef, useMemo, useCallback, useCss,
  useDynamicCss,
  batchUpdateWrapper as batchUpdate, getCurrentComponent
}