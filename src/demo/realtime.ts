/**
 * Demo replacement for a Supabase Realtime channel: broadcast + presence over the browser's
 * BroadcastChannel API. Every instance opens its own BroadcastChannel, and the API delivers a
 * message to every *other* instance with the same name — other tabs and other channels in this
 * tab alike — which matches Supabase's default `self: false` broadcast semantics.
 */

type Listener =
  | { type: 'broadcast'; event: string; cb: (msg: { payload: unknown }) => void }
  | { type: 'presence'; event: string; cb: () => void };

type Wire =
  | { kind: 'broadcast'; event: string; payload: unknown }
  | { kind: 'presence'; key: string; meta: Record<string, unknown> }
  | { kind: 'presence-hello'; key: string }
  | { kind: 'presence-leave'; key: string };

const openChannels = new Set<DemoChannel>();

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const channel of openChannels) channel.unsubscribe();
  });
}

export class DemoChannel {
  private readonly key = crypto.randomUUID();
  private listeners: Listener[] = [];
  private bc: BroadcastChannel | null = null;
  private myMeta: Record<string, unknown> | null = null;
  private peers = new Map<string, Record<string, unknown>>();

  constructor(readonly topic: string) {}

  on(type: 'broadcast' | 'presence', filter: { event: string }, cb: (...args: never[]) => void) {
    this.listeners.push({ type, event: filter.event, cb } as Listener);
    return this;
  }

  subscribe(cb?: (status: string) => void) {
    this.bc = new BroadcastChannel(`wisestep-demo:${this.topic}`);
    this.bc.onmessage = (e: MessageEvent<Wire>) => this.receive(e.data);
    openChannels.add(this);
    this.post({ kind: 'presence-hello', key: this.key });
    setTimeout(() => cb?.('SUBSCRIBED'), 30);
    return this;
  }

  send(message: { type: 'broadcast'; event: string; payload: unknown }) {
    this.post({ kind: 'broadcast', event: message.event, payload: message.payload });
    return Promise.resolve('ok' as const);
  }

  track(meta: Record<string, unknown>) {
    this.myMeta = meta;
    this.post({ kind: 'presence', key: this.key, meta });
    this.emitSync();
    return Promise.resolve('ok' as const);
  }

  presenceState<T>(): Record<string, T[]> {
    const state: Record<string, T[]> = {};
    for (const [key, meta] of this.peers) state[key] = [meta as T];
    if (this.myMeta) state[this.key] = [this.myMeta as T];
    return state;
  }

  unsubscribe() {
    if (!this.bc) return Promise.resolve('ok' as const);
    if (this.myMeta) this.post({ kind: 'presence-leave', key: this.key });
    this.bc.close();
    this.bc = null;
    openChannels.delete(this);
    return Promise.resolve('ok' as const);
  }

  private post(message: Wire) {
    this.bc?.postMessage(message);
  }

  private receive(message: Wire) {
    switch (message.kind) {
      case 'broadcast':
        for (const l of this.listeners) {
          if (l.type === 'broadcast' && l.event === message.event) l.cb({ payload: message.payload });
        }
        return;
      case 'presence-hello':
        if (this.myMeta) this.post({ kind: 'presence', key: this.key, meta: this.myMeta });
        return;
      case 'presence':
        this.peers.set(message.key, message.meta);
        this.emitSync();
        return;
      case 'presence-leave':
        if (this.peers.delete(message.key)) this.emitSync();
        return;
    }
  }

  private emitSync() {
    for (const l of this.listeners) {
      if (l.type === 'presence' && l.event === 'sync') l.cb();
    }
  }
}
