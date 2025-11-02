import { NextJsSite } from "./nextjs";

const site = new NextJsSite("nextjs-pulumi", {
  path: "../apps/web",
});

export const url = site.url;
