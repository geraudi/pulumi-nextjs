interface BlogPost {
  id: string;
  title: string;
  content: string;
}

export async function GET() {
  const posts: BlogPost[] = await fetch("https://api.vercel.app/blog").then(
    (res) => res.json(),
  );

  return Response.json(posts);
}
