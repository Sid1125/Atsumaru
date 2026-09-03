import Link from "next/link";

/**
 * The global 404. Rendered inside the root layout, so the site's header, footer
 * and preloader stay — the visitor never lands on a bare, brandless page.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[72vh] flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <span className="uppercase text-neon text-sm font-semibold tracking-[0.35em]">
        集まる · 404
      </span>
      <h1 className="text-4xl font-bold uppercase leading-[0.9] tracking-tight text-text md:text-6xl">
        This page got
        <br />
        lost in the crowd.
      </h1>
      <p className="max-w-md text-text-muted">
        The link you followed doesn&apos;t point anywhere. No group here — but
        plenty are gathering.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-xl transition-colors hover:bg-accent-strong"
      >
        Gather back home
      </Link>
    </main>
  );
}
