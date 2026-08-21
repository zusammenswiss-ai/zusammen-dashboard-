import Link from "next/link";
import LandingMark from "@/components/LandingMark";
import "../landing.css";

/**
 * Standalone Datenschutzerklärung (privacy notice) for the public
 * /landing funnel. Describes, in plain terms, exactly what this funnel
 * actually collects — matches landing_letters/landing_responses in
 * supabase/schema.sql, no more, no less: the letter text is stored
 * without any identifying data, the survey optionally collects an
 * email address, and nothing is tracked via cookies. Highlighted
 * "BITTE AUSFÜLLEN" placeholders mark the values only the founder can
 * fill in (contact details, Supabase hosting region).
 */
export default function DatenschutzPage() {
  return (
    <div className="landing-root">
      <div className="legal-page">
        <Link href="/landing" className="back">
          ← Zurück zu ZUSAMMEN
        </Link>
        <LandingMark size={64} />
        <h1>Datenschutzerklärung</h1>
        <p className="updated">Stand: <span className="todo">BITTE AUSFÜLLEN: Datum</span></p>

        <h2>1. Verantwortliche Stelle</h2>
        <p>
          <span className="todo">BITTE AUSFÜLLEN: Firmenname / Vor- &amp; Nachname</span>
          <br />
          <span className="todo">BITTE AUSFÜLLEN: Adresse</span>
          <br />
          E-Mail: <span className="todo">BITTE AUSFÜLLEN: kontakt@zusammenswiss.ch</span>
        </p>

        <h2>2. Welche Daten wir erheben</h2>
        <p>Diese Seite sammelt ausschliesslich Daten, die du selbst aktiv eingibst:</p>
        <ul>
          <li>
            <strong>Kurzumfrage:</strong> deine Antworten (z. B. Kaufinteresse, Preisvorstellung,
            gewünschte Boxinhalte, ein optionales Freitextfeld) und, falls du sie angibst, deine
            E-Mail-Adresse.
          </li>
          <li>
            <strong>Brief/Versprechen (Gold-Card-Übung):</strong> der von dir geschriebene Text
            wird gespeichert, um anonym anderen Besucher:innen gezeigt zu werden — ohne Namen,
            E-Mail oder sonstige identifizierende Angaben. Wir können diesen Text keiner Person
            zuordnen.
          </li>
          <li>
            <strong>„Per E-Mail an dich selbst senden&quot;:</strong> öffnet dein eigenes E-Mail-Programm
            (mailto-Link) mit vorausgefülltem Text — dabei läuft nichts über unsere Server, wir
            sehen und speichern diese E-Mail nicht.
          </li>
        </ul>
        <p>Wir verwenden keine Cookies und kein Tracking/Analytics auf dieser Seite.</p>

        <h2>3. Zweck der Verarbeitung</h2>
        <p>
          Die Angaben dienen ausschliesslich der Produktentwicklung von ZUSAMMEN (Marktinteresse,
          Preisgestaltung, Paketinhalte) und, falls von dir gewünscht, der Kontaktaufnahme zu
          Produktneuigkeiten. Die Rechtsgrundlage ist deine freiwillige Eingabe (Einwilligung).
        </p>

        <h2>4. Hosting &amp; Auftragsverarbeitung</h2>
        <p>
          Die Daten werden bei <a href="https://supabase.com" className="inline">Supabase</a>{" "}
          (Serverstandort: <span className="todo">BITTE AUSFÜLLEN: z. B. EU/Frankfurt</span>)
          gespeichert. Supabase verarbeitet die Daten ausschliesslich in unserem Auftrag und hat
          keinen eigenen Zugriff auf die Inhalte.
        </p>

        <h2>5. Weitergabe an Dritte</h2>
        <p>Wir geben deine Daten nicht an Dritte weiter, ausser an den in Punkt 4 genannten Hosting-Anbieter.</p>

        <h2>6. Speicherdauer</h2>
        <p>
          Die Daten werden gespeichert, bis sie für die Produktentwicklung nicht mehr benötigt
          werden, oder bis du ihre Löschung verlangst.
        </p>

        <h2>7. Deine Rechte</h2>
        <p>Du hast jederzeit das Recht auf:</p>
        <ul>
          <li>Auskunft über die zu dir gespeicherten Daten</li>
          <li>Berichtigung unrichtiger Daten</li>
          <li>Löschung deiner Daten</li>
          <li>Einschränkung der Verarbeitung</li>
          <li>Widerspruch gegen die Verarbeitung</li>
        </ul>
        <p>
          Wende dich dazu einfach an{" "}
          <span className="todo">BITTE AUSFÜLLEN: kontakt@zusammenswiss.ch</span>. Da die
          Briefe/Versprechen anonym gespeichert werden, können wir sie ohne weitere Angaben (z. B.
          ungefähres Datum und Wortlaut) leider keiner Person zuordnen.
        </p>

        <p>
          Siehe auch: <Link href="/landing/impressum" className="inline">Impressum</Link>
        </p>
      </div>
    </div>
  );
}
