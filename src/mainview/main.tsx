import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./assets/index.css";

const App = import.meta.env.VITE_MOCK === "1"
	? lazy(() => import("./mock/MockApp"))
	: lazy(() => import("./App"));

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Suspense>
			<App />
		</Suspense>
	</StrictMode>,
);
