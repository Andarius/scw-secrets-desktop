import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const App = import.meta.env.VITE_MOCK === "1"
	? lazy(() => import("./MockApp"))
	: lazy(() => import("./App"));

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Suspense>
			<App />
		</Suspense>
	</StrictMode>,
);
