/**
 * toast — app-wide inline notifications (replaces window.alert).
 *
 *   import { toast } from '../lib/toast';
 *   toast.success('Task assigned.'); toast.error('Could not save.');
 *
 * Fire-and-forget: dispatches a DOM event that <ToastHost /> (mounted once
 * in the authenticated Layout) renders as stacked Notice strips.
 */
export type ToastTone = 'info' | 'success' | 'error';
export type ToastItem = { id: number; tone: ToastTone; text: string };

export const TOAST_EVENT = 'campgains:toast';
let seq = 0;

const push = (tone: ToastTone, text: string) => {
  if (typeof window === 'undefined' || !text) return;
  window.dispatchEvent(new CustomEvent<ToastItem>(TOAST_EVENT, { detail: { id: ++seq, tone, text } }));
};

export const toast = {
  info: (text: string) => push('info', text),
  success: (text: string) => push('success', text),
  error: (text: string) => push('error', text),
};

export default toast;
