import {Joke} from "@/lib/types";

export async function fetchJoke(isCached: boolean): Promise<Joke> {
  try {
    return await fetch(
      "https://official-joke-api.appspot.com/random_joke",
      {
        cache: isCached ? 'force-cache' : 'no-store',
        next: {
          //revalidate: 60,
        }
      }
      ).then(data => data.json());

  } catch (error) {
    console.error('Fetch error:', error);
   // throw new Error('Failed to fetch joke.');
    return {} as Joke;
  }
}
