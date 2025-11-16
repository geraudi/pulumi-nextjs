"use cache";

import "server-only";

import type { Joke } from "@/data/types";

export async function fetchJoke(): Promise<Joke> {
  const data = await fetch("https://official-joke-api.appspot.com/random_joke");

  return data.json();
}
