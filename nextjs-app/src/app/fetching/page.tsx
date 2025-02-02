import {Joke} from "@/lib/types";

export default async function FetchingData() {
  const joke: Joke = await fetch("https://official-joke-api.appspot.com/random_joke", {
    next: {
      revalidate: 10,
    }
  }).then(data => data.json());

  return (
    <div>
        <h1 className="font-bold text-3xl">Fetching Random Joke</h1>
        <h2 className="font-bold text-1xl mb-5">from official-joke-api.appspot.com</h2>
        <p>Revalidated every 10 seconds (refresh page to see new joke)</p>
        <div className="border-2 p-6 mt-5 rounded-2xl border-fuchsia-500">
          <p className="font-bold">{joke.setup}</p>
          <p className="text-2xl mt-2 text-fuchsia-500">{joke.punchline}</p>
        </div>
    </div>
  );
};