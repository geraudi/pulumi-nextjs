"use cache";

import { cacheLife } from "next/cache";
import Link from "next/link";

interface Post {
  id: string;
  title: string;
  content: string;
}

export async function generateStaticParams() {
  const posts: Post[] = await fetch("https://api.vercel.app/blog").then((res) =>
    res.json(),
  );
  return posts.slice(0, 4).map((post) => ({
    id: String(post.id),
  }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ISR-like behavior with Cache Components
  // revalidate: 60 seconds (background refresh)
  cacheLife({
    stale: 300, // 5 minutes client cache
    revalidate: 60, // 60 seconds - similar to old ISR revalidate
    expire: 3600, // 1 hour max
  });

  const id = (await params).id;
  const post: Post = await fetch(`https://api.vercel.app/blog/${id}`).then(
    (res) => res.json(),
  );

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <main>
      <h1 className="text-4xl font-bold mb-10">
        Static Site Generation (SSG) + Cache Components (ISR-like) example
      </h1>
      <h2 className="text-2xl font-bold">{post.title}</h2>
      <em>
        {currentDate} at {currentTime}
      </em>
      <div className="mt-4 p-4 bg-purple-50 border-2 border-purple-500 rounded-lg">
        <p className="text-sm text-purple-700">
          ✓ Using "use cache" + cacheLife (Cache Components mode)
        </p>
        <p className="text-sm text-purple-700">
          ✓ Revalidates every 60 seconds (similar to ISR)
        </p>
        <p className="text-sm text-purple-700">
          ✓ Static params pre-generated at build time
        </p>
      </div>
      <Link
        className="block text-blue-600 mt-4"
        href="https://nextjs.org/docs/app/api-reference/functions/cacheLife"
      >
        Documentation NextJs: cacheLife (Cache Components)
      </Link>
      <p className="mt-5">{post.content}</p>
    </main>
  );
}
