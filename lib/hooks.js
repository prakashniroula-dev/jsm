
/**

  Hook system of jsm
  unique and explicit state management
  designed to be simple, efficient, and easy to use in jsm components
  inspired by React hooks

  assumptions:

  component contains :
    - hooks: array of hook states, indexed by hook call order
    - hookIndex: current hook call index, reset to 0 on each render
    - renderEffects: set of effect indices that should run on every render
    - oneTimeEffects: set of effect indices that should run only once

*/

let currentComponent = null;
const hooksContext = [];

let batchingDepth = 0;
let needsRender = false;
const pendingEffects = new Set();
const pendingRenders = new Set();

function pushHooksContext(component) {
  hooksContext.push(currentComponent);
  currentComponent = component;
}

function popHooksContext() {
  const component = hooksContext.pop();
  currentComponent = component;
}

async function batchUpdate(fn) {
  try {
    batchingDepth++;
    await fn();
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

async function postSetState(component, hookIndex) {
  if ( batchingDepth > 0 ) {
    pendingRenders.add(component);
  } else {
    await component.update();
  }

  const state = component.hooks[hookIndex];
  if ( state.effects.size > 0 ) {
    state.effects.forEach(effectIndex => {
      const hook = component.hooks[effectIndex];
      if ( batchingDepth > 0 ) {
        pendingEffects.add(hook);
      } else {
        hook.effect();
      }
    });
  }
}

function useState(initialValue) {
  const component = currentComponent;
  const hookIndex = component.hookIndex++;
  
  if ( component.hooks[hookIndex] === undefined ) {
    component.hooks[hookIndex] = {value: initialValue, effects: new Set()};
  }
  
  const setter = async (newValue) => {
    const oldValue = component.hooks[hookIndex].value;
    if ( newValue === oldValue ) return;
    if ( typeof newValue === 'function' ) {
      component.hooks[hookIndex].value = newValue(oldValue);
    } else {
      component.hooks[hookIndex].value = newValue;
    }
    
    await postSetState(component, hookIndex);
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
  deps.forEach(dep => {
    const component = dep.component;
    const hookIndex = dep.hookIndex;
    // not a reactive dependency, skip
    if ( component == undefined || hookIndex == undefined ) return;
    // push the effect hook index instead of whole function
    console.log("Subscribing effect", index, "to dependency", dep);
    component.hooks[hookIndex].effects.add(index); 
  });
}

function unsubscribeEffect(index, deps) {
  if ( deps === undefined ) {
    currentComponent.renderEffects.delete(index);
    return;
  }
  if ( deps.length === 0 ) {
    currentComponent.oneTimeEffects.delete(index);
    return;
  }
  deps.forEach(dep => {
    const component = dep.component;
    const hookIndex = dep.hookIndex;
    // not a reactive dependency, skip
    if ( component == undefined || hookIndex == undefined ) return;
    component.hooks[hookIndex].effects.delete(index);
  });
}

function useEffect(effectFn, deps) {
  const component = currentComponent;
  const hookIndex = component.hookIndex++;

  let hook = component.hooks[hookIndex];

  // necessary for one effect function reference wrapped with proper cleanup
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
    if ( oldDeps?.length === deps?.length && oldDeps?.every((dep, i) => dep.hookIndex === deps[i].hookIndex) ) return;

    // remove old effect deps
    unsubscribeEffect(hookIndex, component.hooks[hookIndex].deps);

    // update effect with new deps
    hook.effect = () => effect(hook);
    hook.deps = deps;
    subscribeEffect(hookIndex, deps);
    pendingEffects.add(hook); // schedule to run effect if deps change
  }
}

function useRef(initialValue) {
  const component = currentComponent;
  const hookIndex = component.hookIndex++;
  if ( component.hooks[hookIndex] === undefined ) {
    component.hooks[hookIndex] = {current: initialValue};
  }
  return component.hooks[hookIndex];
}

function useMemo(factory, deps) {
  const component = currentComponent;
  const hookIndex = component.hookIndex++;
  const hook = component.hooks[hookIndex];

  const runFactory = () => {
    const value = factory();
    component.hooks[hookIndex] = { value, deps: deps ? [...deps] : undefined };
    return value;
  };

  if (deps === undefined || hook === undefined) return runFactory();
  if (deps.length === 0) return hook.value;

  const oldDeps = hook.deps;

  if (!oldDeps) return runFactory();

  if (oldDeps.length === deps.length && oldDeps.every((dep, i) => Object.is(dep, deps[i]))) {
    return hook.value;
  }

  return runFactory();
}

function useCallback(callback, deps) {
  return useMemo(() => callback, deps);
}

async function batchUpdateWrapper(instance, callback) {
  pushHooksContext(instance);
  const result = await batchUpdate(callback);
  popHooksContext();
  return result;
}

function getCurrentComponent() {
  return currentComponent;
}

export {
  pushHooksContext, popHooksContext, useState, useEffect, useRef, useMemo, useCallback,
  batchUpdateWrapper as batchUpdate, getCurrentComponent
}