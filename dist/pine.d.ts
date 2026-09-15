/**
 * PineJS v1.7.0 "Douglas"
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

export interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  params?: Record<string, any>;
  query?: Record<string, any>;
  timeout?: number;
  responseType?: 'json' | 'text' | 'blob' | 'auto';
  ignoreStatus?: boolean;
}

export interface FetchResource<T = any> extends PromiseLike<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
  status: number | null;
  ok: boolean;
  headers: Record<string, string>;
  response: Response | null;
  abort(): void;
  refetch(overrideOptions?: Partial<FetchOptions>): Promise<T>;
}

export interface SSEResource<T = any> {
  status: 'connecting' | 'open' | 'closed' | 'error';
  data: T | null;
  text: string;
  event: string;
  lastEventId: string;
  history: T[];
  close(): void;
}

export interface WebSocketResource<T = any> {
  status: 'connecting' | 'open' | 'closed' | 'error';
  data: T | null;
  text: string;
  history: T[];
  send(payload: any): boolean;
  close(): void;
}

export interface FetchClient {
  <T = any>(url: string | (() => string), options?: FetchOptions | (() => FetchOptions)): FetchResource<T>;
  get<T = any>(url: string | (() => string), options?: FetchOptions): FetchResource<T>;
  post<T = any>(url: string | (() => string), body?: any, options?: FetchOptions): FetchResource<T>;
  put<T = any>(url: string | (() => string), body?: any, options?: FetchOptions): FetchResource<T>;
  patch<T = any>(url: string | (() => string), body?: any, options?: FetchOptions): FetchResource<T>;
  delete<T = any>(url: string | (() => string), options?: FetchOptions): FetchResource<T>;
  json<T = any>(url: string | (() => string), options?: FetchOptions): Promise<T>;
}

export interface RouterMatch {
  matches: boolean;
  params: Record<string, string>;
}

export interface RouterAPI {
  readonly path: string;
  readonly query: string;
  readonly params: Record<string, string>;
  readonly hash: string;
  navigate(toPath: string, options?: { replace?: boolean; transition?: boolean }): boolean;
  beforeEach(guardFn: (to: string, from: string) => boolean | void): () => void;
  match(pattern: string, path?: string): RouterMatch;
}

export interface FormInstance<T = Record<string, any>> {
  values: T;
  readonly initial: T;
  errors: Record<string, string | null>;
  touched: Record<string, boolean>;
  readonly dirty: boolean;
  readonly pristine: boolean;
  readonly valid: boolean;
  readonly invalid: boolean;
  readonly submitting: boolean;
  readonly submitted: boolean;
  readonly submitCount: number;
  isDirty(field: keyof T | string): boolean;
  isTouched(field: keyof T | string): boolean;
  touch(field: keyof T | string): void;
  setError(field: keyof T | string, message: string): void;
  setErrors(errors: Partial<Record<keyof T | string, string>>): void;
  clearErrors(): void;
  reset(): void;
  formData(): FormData;
  json(): T;
  submit(endpointOrHandler: string | ((values: T, form: FormInstance<T>) => any), options?: { method?: string; headers?: Record<string, string> }): Promise<any>;
}

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
  $broadcast: <T>(initialValue: T, channelName?: string) => { value: T };
  $viewTransition: (callback: () => void | Promise<void>) => Promise<void>;
  $fetch: FetchClient;
  $sse: <T = any>(url: string | (() => string), options?: { events?: string[]; maxHistory?: number }) => SSEResource<T>;
  $websocket: <T = any>(url: string | (() => string), options?: { autoReconnect?: boolean; maxRetries?: number; protocols?: string | string[]; maxHistory?: number }) => WebSocketResource<T>;
  $ws: <T = any>(url: string | (() => string), options?: { autoReconnect?: boolean; maxRetries?: number; protocols?: string | string[]; maxHistory?: number }) => WebSocketResource<T>;
  $intersect: (callback: (isIntersecting: boolean, entry: IntersectionObserverEntry) => void, options?: IntersectionObserverInit) => void;
  $focus: { focus: (target?: string | HTMLElement) => void; trap: (container?: string | HTMLElement) => void };
  $route: {
    readonly path: string;
    readonly query: string;
    readonly params: Record<string, string>;
    readonly hash: string;
    push(path: string, options?: any): boolean;
    replace(path: string, options?: any): boolean;
    go(delta: number): void;
    active(pattern: string): boolean;
  };
  $form: <T = Record<string, any>>(initialValues?: T, options?: any) => FormInstance<T>;
  $idb: <T = any>(initialValue: T, key: string, dbName?: string, storeName?: string) => { value: T };
  $suspense: (promise: Promise<any>) => void;
  $errors?: Record<string, string | null>;
  $error?: any;
  $valid?: boolean;
  $touched?: Record<string, boolean>;
  $dirty?: Record<string, boolean>;
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

export interface TimelineStep {
  el: HTMLElement | string;
  keyframes: Keyframe[] | PropertyIndexedKeyframes;
  duration?: number;
  delay?: number;
  at?: number;
  easing?: string;
  options?: KeyframeAnimationOptions;
}

export interface TimelineInstance {
  animations: Animation[];
  duration: number;
  play(): void;
  pause(): void;
  reverse(): void;
  finish(): void;
  cancel(): void;
}

export interface WorkerSignal<T = any> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: string | null;
  compute(payload: any): Promise<T>;
  terminate(): void;
}

export interface PineAPI {
  version: '1.7.0';
  versionName: 'Douglas';

  // Router Engine
  router: RouterAPI;

  // Form Engine
  form: <T = Record<string, any>>(initialValues?: T, options?: any) => FormInstance<T>;

  // IDB Offline Engine
  idb: <T = any>(initialValue: T, key: string, dbName?: string, storeName?: string) => { value: T };

  // Component & SSR Engines
  loadComponent: (url: string, options?: { forceReload?: boolean }) => Promise<string>;
  componentCache: Map<string, string>;
  renderToString: (templateHtml: string, initialData?: Record<string, any>, options?: { data?: Record<string, any> }) => string;

  // Prefix Configuration
  prefix: (newPrefix?: string | string[]) => string[];

  // Signals, Fetch, Timeline & Templates
  signal: typeof signal;
  computed: typeof computed;
  effect: typeof effect;
  batch: typeof batch;
  untrack: typeof untrack;
  reactive: typeof reactive;
  raw: typeof raw;
  fetch: FetchClient;
  sse: <T = any>(url: string | (() => string), options?: { events?: string[]; maxHistory?: number }) => SSEResource<T>;
  websocket: <T = any>(url: string | (() => string), options?: { autoReconnect?: boolean; maxRetries?: number; protocols?: string | string[]; maxHistory?: number }) => WebSocketResource<T>;
  ws: <T = any>(url: string | (() => string), options?: { autoReconnect?: boolean; maxRetries?: number; protocols?: string | string[]; maxHistory?: number }) => WebSocketResource<T>;
  timeline: (steps: TimelineStep[], globalOptions?: KeyframeAnimationOptions) => TimelineInstance;
  html: (strings: TemplateStringsArray, ...values: any[]) => HTMLElement | DocumentFragment;
  tpl: (strings: TemplateStringsArray, ...values: any[]) => HTMLElement | DocumentFragment;
  worker: <T = any>(fnOrCode: ((payload: any) => T | Promise<T>) | string) => WorkerSignal<T>;

  // Diagnostics & DevTools
  devtools: DevToolsAPI;

  // Component Registration
  data: (name: string, factory: (...args: any[]) => Record<string, any>) => void;
  bind: (name: string, callback: () => Record<string, any>) => void;
  store: (name: string, data?: any) => any;
  directive: (name: string, callback: DirectiveHandler) => void;
  magic: (name: string, callback: MagicFactory) => void;
  plugin: (pluginFn: PluginFn) => void;
  morph: (fromEl: HTMLElement, toEl: HTMLElement | string) => void;
  start: () => void;
  initTree: (element: HTMLElement) => void;
  destroyTree: (element: HTMLElement) => void;
  startObserver: () => void;
  stopObserver: () => void;

  // Security & Error Boundaries
  csp: (enable?: boolean) => boolean;
  onError: (callback: (err: any, el?: HTMLElement, expression?: string) => void) => () => void;

  $data: (element: HTMLElement) => Record<string, any> | null;
}

export const Pine: PineAPI;
export default Pine;
