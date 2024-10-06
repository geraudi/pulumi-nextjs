import {Suspense} from "react";

export default async function FetchingData() {
  const joke = await fetch("https://official-joke-api.appspot.com/random_joke", { cache: 'no-store' }).then(data => data.json());

  return (
    <div>
      <Suspense fallback="Loading...">
        <h1 className="font-bold text-3xl">Fetching Random Joke</h1>
        <h2 className="font-bold text-1xl">from official-joke-api.appspot.com</h2>
        <p className="mt-10">With no cache: </p>
        <div className="border-2 p-6 mt-5 rounded-2xl border-fuchsia-500">
          <p className="font-bold">{joke.setup}</p>
          <p className="text-2xl mt-2 text-fuchsia-500">{joke.punchline}</p>
        </div>
      </Suspense>
    </div>
  );
};
