import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app.tsx";

const renderer = await createCliRenderer({ exitOnCtrlC: true, backgroundColor: "#0d1526" });
const root = createRoot(renderer);
root.render(<App />);

renderer.once("destroy", () => {
  root.unmount();
});
