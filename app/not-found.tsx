export default function NotFound() {
  return (
    <main className="form-step">
      <h1>Page not found</h1>
      <p>
        This Campus Radar address is unavailable. Explore the product, sign in
        to your brief, or read the access guide.
      </p>
      <nav>
        <a href="/">Home</a> · <a href="/beta">Your brief</a> ·{" "}
        <a href="/docs">Product guide</a>
      </nav>
    </main>
  );
}
