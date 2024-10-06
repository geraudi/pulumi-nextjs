import { NextJsSite } from "./nextjs";

const site = new NextJsSite("nextjs-pulumi", {
  path: "../nextjs-app",
});

export const url = site.url;
