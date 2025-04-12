import Link from "next/link";

export default function Home() {
  return (
    <>
      <p className="text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
        Nextjs example deployed with Pulumi on AWS
      </p>

      <div className="flex gap-4 items-center flex-col sm:flex-row">
        <Link
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
          href="/fetching"
          rel="noopener noreferrer"
        >
          Fetching data from an external API
        </Link>
        <Link
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
          href="/blog/1"
          rel="noopener noreferrer"
        >
          Dynamic route
        </Link>
        <div>
          <Link
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
            href="/api"
            rel="noopener noreferrer"
          >
            Route handler (API)
          </Link>
        </div>
      </div>
    </>
  );
}
