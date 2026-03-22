# jsm - javascript minimal reactive library

A small reactive component system for the browser with hook-style APIs, lightweight DOM diffing, and a declarative component model.
Live example to-do app : [view it live](https://prakashniroula-dev.github.io/jsm)

## Overview

`jsm` is a minimal JavaScript reactive system designed for learning and building interactive frontend experiences without React, Vue, or heavy frameworks.

It provides:

- `Jsm()` component wrapper
- DOM element helpers: `Div`, `Span`, `Button`, `Input`, `Form`, etc.
- Hooks:
  - `useState` (reactive local state)
  - `useEffect` (side effects, cleanup, dependencies)
  - `useMemo` (expensive computed values)
  - `useCallback` (stable function refs)
- Diff-based DOM updates in `render.js`
- Lightweight component lifecycle with mount/unmount/effect tracking

## File structure

- `app.js`: Demo todo application showcase
- `test.html`: Bootstraps `App()` into `#app`
- `lib/`: Core library files
  - `lib/jsm.js`: Main exports and API surface
  - `lib/hooks.js`: Hook engine and batching (`useState`, `useEffect`, etc.)
  - `lib/component.js`: `Jsm`, `JsmDom`, and props parsing
  - `lib/render.js`: DOM renderer + reconciler
  - `lib/elements.js`: HTML tag helpers

## Todo Showcase App

`app.js` is the project example and demonstrates all major framework features:

- `useState` for todos, input text, status message
- `useEffect`: derived text updates + auto-focus + interval cleanup
- `useMemo`: computed lists for active/completed todos
- `useCallback`: stable handlers (`addTodo`, `toggleTodo`, `clearCompleted`)
- dynamic element rendering and array mapping
- plain CSS styles in JS via `style` prop

### Features in demo

- Add a todo
- Toggle completion (checkbox)
- Remove a todo
- Complete all
- Clear completed
- Status counters (active / completed / total)
- auto-save debug log interval

##  Usage

1. Open `test.html` in a browser
2. Interact with the todo list
3. Inspect console for auto-save logging

## How to extend

- Add more components using `Jsm()`.
- Add hook support for `useRef` and custom hooks as needed.
- Enhance `render.js` DOM diffing for keyed lists.
- Add tests in a separate test runner of choice.

##  Author

- GitHub: [prakashniroula-dev](https://github.com/prakashniroula-dev)

## 📜 License

MIT
