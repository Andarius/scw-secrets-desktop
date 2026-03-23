import Electrobun, { Electroview } from "electrobun/view";

import type { AppRPCContract } from "../shared/rpc";

const rpc = Electroview.defineRPC<AppRPCContract>({
	maxRequestTime: 30000,
	handlers: {
		requests: {},
		messages: {},
	},
});

export const electrobun = new Electrobun.Electroview({ rpc });
