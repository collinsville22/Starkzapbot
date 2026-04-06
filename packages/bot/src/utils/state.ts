interface UserState {
  flow: string;
  step: string;
  data: Record<string, string>;
  cache: Record<string, any>; // store lists for index-based callbacks
  expires: number;
}

const states = new Map<number, UserState>();

export function setState(userId: number, flow: string, step: string, data: Record<string, string> = {}) {
  states.set(userId, { flow, step, data, cache: {}, expires: Date.now() + 300000 });
}

export function getState(userId: number): UserState | null {
  const s = states.get(userId);
  if (!s || s.expires < Date.now()) { states.delete(userId); return null; }
  return s;
}

export function updateState(userId: number, step: string, extraData: Record<string, string> = {}) {
  const s = states.get(userId);
  if (s) {
    s.step = step;
    s.data = { ...s.data, ...extraData };
    s.expires = Date.now() + 300000;
  }
}

export function setCache(userId: number, key: string, value: any) {
  const s = states.get(userId);
  if (s) s.cache[key] = value;
}

export function getCache(userId: number, key: string): any {
  return states.get(userId)?.cache?.[key];
}

export function clearState(userId: number) {
  states.delete(userId);
}
