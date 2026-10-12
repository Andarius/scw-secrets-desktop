import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { isMock } from "./lib/runtime";
import "./assets/index.css";

const App = isMock
	? lazy(() => import("./mock/MockApp"))
	: lazy(() => import("./App"));

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Suspense>
			<App />
		</Suspense>
	</StrictMode>,
);
