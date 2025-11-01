import Link from "next/link";

interface Post {
  id: string;
  title: string;
  content: string;
}

// Next.js will invalidate the cache when a
// request comes in, at most once every 60 seconds.
export const revalidate = 60;

// We'll prerender only the params from `generateStaticParams` at build time.
// If a request comes in for a path that hasn't been generated,
// Next.js will server-render the page on-demand.
export const dynamicParams = true; // or false, to 404 on unknown paths

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
        Static Site Generation (SSG) + Incremental Static Regeneration (ISR)
        example
      </h1>
      <h2 className="text-2xl font-bold">{post.title}</h2>
      <em>
        {currentDate} at {currentTime}
      </em>
      <Link
        className="block text-blue-600 mt-4"
        href="https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration"
      >
        Documentation NextJs: Incremental Static Regeneration (ISR)
      </Link>
      <p className="mt-5">{post.content}</p>
    </main>
  );
}
