import { zFactBase, type FactBase } from '@/lib/facts/schema';

/**
 * Split out of `actions.ts` on purpose: a `'use server'` file may only
 * export async functions — Next.js's client/server boundary transform turns
 * every other export (a plain constant, here) into something that is not
 * the value it looks like, and `DOMAINS.map is not a function` is what that
 * looks like from the client. A page and its server actions can still share
 * this constant; it just cannot live in the same file as the actions.
 */
export const DOMAINS = Object.keys(zFactBase.shape) as (keyof FactBase)[];
