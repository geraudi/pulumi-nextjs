export default function Home() {
  return (
    <>
      <p className="text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
        Nextjs example deployed with Pulumi on AWS
      </p>

      <div className="flex gap-4 items-center flex-col sm:flex-row">
        <a
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
          href="/fetching"
          rel="noopener noreferrer"
        >
          Fetching data from an external API
        </a>
        <a
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
          href="/blog"
          rel="noopener noreferrer"
        >
          Blog
        </a>
      </div>
    </>
  );
}
