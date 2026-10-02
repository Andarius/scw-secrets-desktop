import { expect, spyOn, test } from "bun:test";

import { copySecret } from "../../src/mainview/lib/clipboard";

test("secret clipboard expiry preserves replacements, newer copies and denied reads", async () => {
	const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
	let clipboard = "";
	let denyRead = false;
	let failWrite = false;
	let finishWrite: (() => void) | undefined;
	let delayWrite = false;
	let expire: () => Promise<void> = async () => {};
	const timer = spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => Promise<void>, delay: number) => {
		expect(delay).toBe(45_000);
		expire = callback;
		return 1;
	}) as typeof setTimeout);
	const clear = spyOn(globalThis, "clearTimeout").mockImplementation(() => {});
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: {
			writeText: async (text: string) => {
				if (failWrite) throw new Error("write failed");
				if (delayWrite) await new Promise<void>((resolve) => { finishWrite = resolve; });
				clipboard = text;
			},
			readText: async () => {
				if (denyRead) throw new Error("permission denied");
				return clipboard;
			},
		},
	});
	try {
		await copySecret("first");
		expect(clipboard).toBe("first");
		await expire();
		expect(clipboard).toBe("");

		await copySecret("second");
		clipboard = "user replacement";
		await expire();
		expect(clipboard).toBe("user replacement");

		await copySecret("same secret");
		const oldExpiry = expire;
		await copySecret("same secret");
		await oldExpiry();
		expect(clipboard).toBe("same secret");
		await expire();
		expect(clipboard).toBe("");
		expect(clear).toHaveBeenCalledTimes(4);

		await copySecret("pending copy");
		const previousExpiry = expire;
		delayWrite = true;
		const pendingCopy = copySecret("pending copy");
		await previousExpiry();
		expect(clipboard).toBe("pending copy");
		delayWrite = false;
		finishWrite!();
		await pendingCopy;
		await expire();
		expect(clipboard).toBe("");

		delayWrite = true;
		const olderCopy = copySecret("older copy");
		delayWrite = false;
		await copySecret("newer copy");
		const newerExpiry = expire;
		finishWrite!();
		await olderCopy;
		expect(clipboard).toBe("older copy");
		await newerExpiry();
		expect(clipboard).toBe("older copy");
		await expire();
		expect(clipboard).toBe("");

		await copySecret("lease before failure");
		const leaseBeforeFailure = expire;
		failWrite = true;
		await expect(copySecret("failed copy")).rejects.toThrow("write failed");
		failWrite = false;
		await leaseBeforeFailure();
		expect(clipboard).toBe("");

		await copySecret("read unavailable");
		denyRead = true;
		await expire();
		expect(clipboard).toBe("read unavailable");
	} finally {
		timer.mockRestore();
		clear.mockRestore();
		if (original) Object.defineProperty(navigator, "clipboard", original);
		else Reflect.deleteProperty(navigator, "clipboard");
	}
});
