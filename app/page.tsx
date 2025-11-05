export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>careerme</h1>
      <p>Phase 0 bootstrap OK.</p>
      <ul>
        <li><a href='/api/healthz'>/api/healthz</a></li>
        <li><a href='/api/data/resume?id=demo'>/api/data/resume?id=demo</a></li>
      </ul>
    </main>
  )
}
