import { fetchJoke } from "@/data/fetch-joke";

/**
 * Joke component that fetches a joke from an API and displays it.
 */
export default async function Joke() {
  const joke = await fetchJoke();

  return (
    <div className="border-2 p-6 mt-5 rounded-2xl border-fuchsia-500">
      <p className="font-bold">{joke.setup}</p>
      <p className="text-2xl mt-2 text-fuchsia-500">{joke.punchline}</p>
    </div>
  );
}
