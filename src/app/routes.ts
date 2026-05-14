import { createBrowserRouter } from "react-router";
import { Home } from "./pages/Home";
import { Analyzer } from "./pages/Analyzer";
import { Results } from "./pages/Results";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/analyzer",
    Component: Analyzer,
  },
  {
    path: "/results",
    Component: Results,
  },
]);
