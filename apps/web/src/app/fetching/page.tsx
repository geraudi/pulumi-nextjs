import { Suspense } from "react";
import Joke from "@/components/joke";

export default async function FetchingData() {
  console.log("fetching");
  return (
    <div className="p-6 space-y-6">
      {/* STATIC SHELL - Rendered immediately and served as static HTML */}
      <div className="border-4 border-blue-500 p-6 rounded-lg bg-blue-50">
        <div className="mb-2 text-xs font-mono text-blue-600">
          ⚡ STATIC SHELL (PPR)
        </div>
        <h1 className="font-bold text-3xl">
          Partial Prerendering (PPR) + Cache Components
        </h1>
        <h2 className="font-bold text-xl mt-2">
          Fetching Random Joke from official-joke-api.appspot.com
        </h2>
        <div className="mt-4 text-sm text-blue-700">
          <p>✓ This section renders instantly (static HTML)</p>
          <p>✓ No waiting for data fetching</p>
        </div>
      </div>

      {/* DYNAMIC STREAMING - Streams in after data is fetched/cached */}
      <div className="border-4 border-fuchsia-500 p-6 rounded-lg bg-fuchsia-50">
        <div className="mb-2 text-xs font-mono text-fuchsia-600">
          🔄 DYNAMIC STREAMING (PPR + Cache Components)
        </div>
        <div className="text-sm text-fuchsia-700 mb-4">
          <p>✓ This section streams in after the static shell</p>
          <p>✓ Uses "use cache" directive (cached for 15 min by default)</p>
          <p>✓ First visit: fetches fresh data</p>
          <p>✓ Subsequent visits: serves from cache</p>
        </div>
        <Suspense
          fallback={
            <div className="border-2 border-dashed border-fuchsia-400 p-6 rounded-lg bg-white animate-pulse">
              <p className="text-fuchsia-600">
                ⏳ Loading joke from cache or API...
              </p>
            </div>
          }
        >
          <Joke />
        </Suspense>
      </div>
    </div>
  );
}
