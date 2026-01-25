import { create } from "zustand";

interface Track {
  id: string;
  title: string | null;
  audioUrl: string | null;
  artwork: string | null;
  prompt: string | null;
  createdByUserName: string | null;
}

interface PlayerStore {
  track: Track | null;
  setTrack: (track: Track) => void;
  clearTrack: () => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  track: null,
  setTrack: (track) => set({ track }),
  clearTrack: () => set({ track: null }),
}));