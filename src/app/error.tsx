"use client";

export default function ErrorePagina({
  reset: riprova,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="contenuto pagina">
      <p className="soprattitolo">FridgeBrain</p>
      <h1>Non siamo riusciti ad aprire la cucina.</h1>
      <p>Riprova tra un momento. I tuoi dati restano sul server di casa.</p>
      <button className="pulsante primario" onClick={riprova}>
        Riprova
      </button>
    </main>
  );
}
