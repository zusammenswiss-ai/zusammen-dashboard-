import Link from "next/link";
import LandingMark from "@/components/LandingMark";
import "../landing.css";

/**
 * Standalone Impressum (legal notice) for the public /landing funnel.
 * German-only by design — Impressumspflicht is a DE/CH legal concept, so
 * an English translation isn't meaningful here the way it is elsewhere
 * on the funnel. Every value that needs the founder's real business
 * details is marked with a highlighted "BITTE AUSFÜLLEN" placeholder —
 * fill them in here before sharing the /landing link publicly.
 */
export default function ImpressumPage() {
  return (
    <div className="landing-root">
      <div className="legal-page">
        <Link href="/landing" className="back">
          ← Zurück zu ZUSAMMEN
        </Link>
        <LandingMark size={64} />
        <h1>Impressum</h1>
        <p className="updated">Angaben gemäss Art. 3 UWG / § 5 TMG</p>

        <h2>Anbieterin</h2>
        <p>
          <span className="todo">BITTE AUSFÜLLEN: Firmenname / Vor- &amp; Nachname</span>
          <br />
          <span className="todo">BITTE AUSFÜLLEN: Strasse &amp; Hausnummer</span>
          <br />
          <span className="todo">BITTE AUSFÜLLEN: PLZ &amp; Ort</span>
          <br />
          <span className="todo">BITTE AUSFÜLLEN: Land</span>
        </p>

        <h2>Kontakt</h2>
        <p>
          E-Mail: <span className="todo">BITTE AUSFÜLLEN: kontakt@zusammenswiss.ch</span>
          <br />
          Telefon (optional): <span className="todo">BITTE AUSFÜLLEN oder Zeile entfernen</span>
        </p>

        <h2>Handelsregister / UID (falls vorhanden)</h2>
        <p>
          Noch nicht als Firma eingetragen? Diese Zeile kann bis zur Eintragung entfernt werden —
          ein Impressum als Einzelperson (Name, Adresse, E-Mail) ist rechtlich ausreichend, solange
          kein Handelsregistereintrag besteht.
          <br />
          Handelsregister-Nr.: <span className="todo">BITTE AUSFÜLLEN oder Zeile entfernen</span>
          <br />
          UID / MWST-Nr.: <span className="todo">BITTE AUSFÜLLEN oder Zeile entfernen</span>
        </p>

        <h2>Verantwortlich für den Inhalt</h2>
        <p>
          <span className="todo">BITTE AUSFÜLLEN: Name der verantwortlichen Person</span>, Adresse
          wie oben.
        </p>

        <h2>Haftungsausschluss</h2>
        <p>
          Diese Website dient der Vorstellung von ZUSAMMEN und der Sammlung von Rückmeldungen im
          Rahmen der Produktentwicklung. Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir
          keine Haftung für die Inhalte externer Links; für den Inhalt der verlinkten Seiten sind
          ausschliesslich deren Betreiber verantwortlich.
        </p>

        <p>
          Siehe auch: <Link href="/landing/datenschutz" className="inline">Datenschutzerklärung</Link>
        </p>
      </div>
    </div>
  );
}
