import { isTauri } from "@tauri-apps/api/core";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

export const writeClipboardText = (text: string): Promise<void> =>
	isTauri() ? writeText(text) : navigator.clipboard.writeText(text);

const readClipboardText = (): Promise<string> =>
	isTauri() ? readText() : navigator.clipboard.readText();

let clearTimer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let latestSuccessfulGeneration = 0;
let pendingWrites = 0;

function scheduleExpiry(text: string, copiedGeneration: number): void {
	clearTimer = setTimeout(async () => {
		try {
			if (copiedGeneration !== latestSuccessfulGeneration) return;
			if (pendingWrites > 0) {
				scheduleExpiry(text, copiedGeneration);
				return;
			}
			if (await readClipboardText() === text && copiedGeneration === latestSuccessfulGeneration) {
				if (pendingWrites > 0) {
					scheduleExpiry(text, copiedGeneration);
					return;
				}
				await writeClipboardText("");
			}
		} catch {
			// Clipboard reads may require focus or permission; never clear blindly.
		}
	}, 45_000);
}

export async function copySecret(text: string): Promise<void> {
	const copiedGeneration = ++generation;
	pendingWrites++;
	try {
		await writeClipboardText(text);
	} finally {
		pendingWrites--;
	}
	clearTimeout(clearTimer);
	latestSuccessfulGeneration = copiedGeneration;
	scheduleExpiry(text, copiedGeneration);
}
