import type { Joke } from "@/data/types";

export async function fetchJoke(isCached: boolean): Promise<Joke> {
	return await fetch("https://official-joke-api.appspot.com/random_joke", {
		cache: isCached ? "force-cache" : "no-store",
		next: {},
	}).then((data) => data.json());
}
