import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { AssistantChatReply } from "../types";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Present on assistant turns that proposed or ran actions. */
  reply?: AssistantChatReply;
  /** Per-action outcome after the faculty confirmed. */
  outcome?: { summary: string; results: Array<{ index: number; ok: boolean; skipped?: boolean; error?: string; result?: unknown }> };
  createdAt: string;
}

interface AssistantState {
  open: boolean;
  /** Bubble top-left in viewport px; null = default bottom-right corner. */
  position: { x: number; y: number } | null;
  messages: AssistantMessage[];
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setPosition: (position: { x: number; y: number } | null) => void;
  push: (message: AssistantMessage) => void;
  update: (id: string, patch: Partial<AssistantMessage>) => void;
  clear: () => void;
}

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set) => ({
      open: false,
      position: null,
      messages: [],
      setOpen: (open) => set({ open }),
      toggle: () => set((s) => ({ open: !s.open })),
      setPosition: (position) => set({ position }),
      push: (message) => set((s) => ({ messages: [...s.messages.slice(-40), message] })),
      update: (id, patch) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      clear: () => set({ messages: [] }),
    }),
    { name: "acadiq-assistant", storage: createJSONStorage(() => localStorage), partialize: (s) => ({ messages: s.messages, open: s.open, position: s.position }) }
  )
);
