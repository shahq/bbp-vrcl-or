import serverBundle from "./vercel-server-bundle.cjs";

const { createApp } = serverBundle;

const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}
