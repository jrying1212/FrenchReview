import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="page-shell state-page" tabIndex={-1}>
      <p className="eyebrow">Not found</p>
      <h1>That lesson is not here.</h1>
      <p className="site-intro">
        It may have been removed, or the address may be incomplete.
      </p>
      <Link className="button-link" href="/">
        Return to lessons
      </Link>
    </main>
  );
}
