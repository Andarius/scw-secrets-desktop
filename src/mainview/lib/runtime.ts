import { isTauri } from "@tauri-apps/api/core";

export const isMock = import.meta.env.VITE_MOCK === "1" || !isTauri();
