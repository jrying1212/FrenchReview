export default function Home() {
  return (
    <main id="main-content" className="page-shell" tabIndex={-1}>
      <header className="site-header">
        <p className="eyebrow" lang="fr">
          Révision personnelle
        </p>
        <h1>French review</h1>
        <p className="site-intro">
          Turn your class notes into a focused place to review vocabulary,
          sentences, grammar, and pronunciation.
        </p>
      </header>

      <section className="empty-state" aria-labelledby="lessons-heading">
        <div>
          <p className="section-label">Lessons</p>
          <h2 id="lessons-heading">Your lessons will live here.</h2>
          <p>
            Lesson creation arrives in the next implementation slice. This
            workspace is ready for your first class review.
          </p>
        </div>
        <span className="lesson-marker" aria-hidden="true">
          01
        </span>
      </section>
    </main>
  );
}
