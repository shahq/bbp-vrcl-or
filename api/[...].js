import serverBundle from "./vercel-server-bundle.cjs";

const { createApp } = serverBundle;

const appPromise = createApp();

export default async function handler(req, res) {
  const app = await appPromise;
  return app(req, res);
}
