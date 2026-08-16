import { Config } from "@remotion/cli/config";
import path from "node:path";

// Use jpeg for preview thumbnails (faster than png, good enough for studio).
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Pin React/JSX paths so nested node_modules in the parent repo don't yield
// duplicate React copies (which silently breaks hooks). This is build hygiene,
// not styling — Remotion projects sharing a workspace need this whenever the
// repo carries other React installs.
Config.overrideWebpackConfig((current) => ({
  ...current,
  resolve: {
    ...current.resolve,
    alias: {
      ...current.resolve?.alias,
      react: path.resolve("node_modules/react"),
      "react-dom": path.resolve("node_modules/react-dom"),
      "react/jsx-runtime": path.resolve("node_modules/react/jsx-runtime.js"),
      "react-dom/client": path.resolve("node_modules/react-dom/client.js"),
    },
  },
}));
