export default function LoadingLesson() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      aria-label="Loading lesson"
      className="page-shell state-page"
      tabIndex={-1}
    >
      <p className="eyebrow">Lesson</p>
      <h1>Loading your lesson…</h1>
      <div className="loading-line" aria-hidden="true" />
      <div className="loading-line short" aria-hidden="true" />
    </main>
  );
}
