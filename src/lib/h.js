// One import point for the UI layer: Preact + hooks + htm tagged templates.
import { h, render, Fragment, createContext, createRef } from '../vendor/preact.mjs';
import htm from '../vendor/htm.mjs';

export const html = htm.bind(h);
export { h, render, Fragment, createContext, createRef };
export {
  useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, useReducer, useContext, useId,
} from '../vendor/hooks.mjs';
