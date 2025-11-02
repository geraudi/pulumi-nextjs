import { Suspense } from "react";
import Joke from "@/components/joke";

export default async function FetchingData() {
  return (
    <div>
      <h1 className="font-bold text-3xl">Partial Rendering (PPR) example.</h1>
      <h2 className="font-bold text-1xl mb-5">
        Fetching Random Joke from official-joke-api.appspot.com
      </h2>
      <Suspense fallback={<div>Loading...</div>}>
        <Joke />
      </Suspense>
    </div>
  );
}
