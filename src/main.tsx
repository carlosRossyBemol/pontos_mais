import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import { QueryProvider } from "./providers/QueryProvider";


createRoot(document.getElementById("root")!).render(
    <QueryProvider>
        <BrowserRouter basename="/pontos_mais">
            <App />
        </BrowserRouter>
    </QueryProvider>
);
