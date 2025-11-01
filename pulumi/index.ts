import { NextJsSite } from "./nextjs";
import functionConfig from "./nextjs-app-functions.config";

const site = new NextJsSite("nextjs-pulumi", {
  path: "../nextjs-app",
  functionConfig: functionConfig,
});

export const url = site.url;
