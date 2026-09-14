/**
 * PineJS v1.3.0 "Cedar"
 * TypeScript Declaration File
 * (c) 2026 PineJS Core Team - MIT License
 */

export interface Signal<T = any> {
  value: T;
  peek(): T;
  notify(): void;
}

export interface Computed<T = any> {
  readonly value: T;
  peek(): T;
  destroy(): void;
}

export type CleanupFn = () => void;
export type EffectFn = (onCleanup: (fn: CleanupFn) => void) => void;
export type StopFn = () => void;

export function signal<T>(initialValue: T): Signal<T>;
export function computed<T>(getter: () => T): Computed<T>;
export function effect(fn: EffectFn, options?: { scheduler?: () => void }): StopFn;
export function batch<T>(fn: () => T): T;
export function untrack<T>(fn: () => T): T;
export function reactive<T extends object>(target: T): T;
export function raw<T>(proxyObj: T): T;

export interface MagicScope {
  $el: HTMLElement;
  $root: HTMLElement;
  $data: Record<string, any>;
  $refs: Record<string, HTMLElement>;
  $store: (name?: string) => any;
  $watch: (getterOrProp: string | (() => any), callback: (newVal: any, oldVal: any) => void, options?: { immediate?: boolean }) => StopFn;
  $dispatch: (eventName: string, detail?: any, options?: CustomEventInit) => void;
  $nextTick: (callback?: () => void) => Promise<void>;
  $id: (name?: string, key?: string | null) => string;
  $signal: <T>(val: T) => Signal<T>;
  $persist: <T>(initialValue: T, keyName?: string) => { value: T };
  $history: <T>(initialValue: T, paramName?: string) => { value: T };
  $fetch: (url: string, options?: RequestInit) => { loading: boolean; data: any; error: string | null; status: number | null };
  $intersect: (callback: (isIntersecting: boolean, entry: IntersectionObserverEntry) => void, options?: IntersectionObserverInit) => void;
  $focus: { focus: (target?: string | HTMLElement) => void; trap: (container?: string | HTMLElement) => void };
}

export interface DirectiveContext {
  name: string;
  directive: string;
  arg: string | null;
  modifiers: string[];
  expression: string;
}

export type DirectiveHandler = (el: HTMLElement, context: DirectiveContext) => void;
export type MagicFactory = (el: HTMLElement, additionalContext?: Record<string, any>) => any;
export type PluginFn = (pine: typeof Pine) => void;

export interface DevToolsInspection {
  element: HTMLElement;
  data: Record<string, any> | null;
  parent: HTMLElement | null;
  cleanupsCount: number;
}

export interface DevToolsAPI {
  getRoots: () => HTMLElement[];
  getScope: (element: HTMLElement) => any;
  getSignalMap: () => WeakMap<any, any>;
  inspect: (element: HTMLElement) => DevToolsInspection;
}

export interface PineAPI {
  version: '1.3.0';
  versionName: 'Cedar';

  // Signals
  signal: typeof signal;
  computed: typeof computed;
  effect: typeof effect;
  batch: typeof batch;
  untrack: typeof untrack;
  reactive: typeof reactive;
  raw: typeof raw;

  // Diagnostics & DevTools
  devtools: DevToolsAPI;

  // Component Registration
  data: (name: string, factory: () => Record<string, any>) => void;
  bind: (name: string, callback: () => Record<string, any>) => void;
  store: (name: string, data?: any) => any;
  directive: (name: string, callback: DirectiveHandler) => void;
  magic: (name: string, callback: MagicFactory) => void;
  plugin: (pluginFn: PluginFn) => void;
  morph: (fromEl: HTMLElement, toEl: HTMLElement | string) => void;
  start: () => void;
  initTree: (element: HTMLElement) => void;
  $data: (element: HTMLElement) => Record<string, any> | null;
}

export const Pine: PineAPI;
export default Pine;
