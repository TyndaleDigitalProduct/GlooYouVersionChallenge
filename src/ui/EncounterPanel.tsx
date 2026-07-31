import { useEffect, useMemo, useState } from "react";
import { highlightPassage } from "@/app/highlightController";
import type { PassageResult } from "@/app/providers";
import type { AppRuntime } from "@/app/runtime";
import { cardsAreFallback, hasReadBothPassages, hasReadPassage } from "@/app/viewStore";
import { fallbackCardSetFor } from "@/content/cardSets";
import { guideArtFor } from "@/content/cast";
import { findCrossReferenceContent } from "@/content/loadContent";
import { type EncounterCard, type EncounterRecord, encounterRecord } from "@/core/encounters";
import { shuffledCards } from "./cardOrder";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";

export function EncounterPanel() {
  const openReference = useViewState((state) => state.openEncounterReference);
  if (!openReference) return null;
  return <EncounterPanelBody key={openReference} reference={openReference} />;
}

/**
 * One cross-reference encounter (ADR-0003, PRD-08 phase 3): both Scripture
 * passages must be read before the six insight cards unlock; locking up to
 * three selections reveals all six values plus the curated note. Built
 * entirely against the fallback card sets in content/daniel-1.cards.json —
 * there is no Gloo call anywhere in this path (that is PRD-09).
 */
function EncounterPanelBody({ reference }: { reference: string }) {
  const runtime = useRuntime();
  const crossRef = findCrossReferenceContent(runtime.content, reference);
  const sceneId = crossRef?.sceneId ?? "";
  const anchor = crossRef?.anchor ?? reference;

  const record = useGameState((store) => encounterRecord(store.encounters, sceneId, reference));
  const bothRead = useViewState((state) => hasReadBothPassages(state, reference, anchor));
  // PRD-09: when the cards are the reviewed fallback (no Gloo credential, or a
  // live generation degraded), the panel says so rather than presenting them
  // as model output.
  const isFallback = useViewState((state) => cardsAreFallback(state, reference));

  const [selections, setSelections] = useState<string[]>([]);
  // A missing portrait degrades to a panel without one, never to a broken
  // image icon.
  const [portraitBroken, setPortraitBroken] = useState(false);

  // PRD-14: the deck is dealt in shuffled display order — the stored order is
  // value-descending, which let a player lock the top three without reading.
  // Memoised on the cards array (whose reference survives locking) so the
  // order holds steady from selection through the reveal within one open;
  // every fresh open of the panel remounts the body (keyed on the reference
  // above) and deals anew.
  const displayCards = useMemo(
    () => (record.cards ? shuffledCards(record.cards) : undefined),
    [record.cards],
  );

  if (!crossRef) return null;

  // The operator's settled call (PRD-08 phase 3 specifics): render the real
  // persona name when content supplies one (currently "the Chronicler" and
  // "the Watchman" only) and fall back to the generic section title for the
  // other four, rather than inventing names characters.json does not have.
  const persona = fallbackCardSetFor(runtime.cardSets, reference)?.persona;
  const title = persona ?? `${crossRef.section} guide`;

  const art = guideArtFor(runtime.cast, crossRef.section);
  const showPortrait = art !== undefined && !portraitBroken;

  const isResolved = record.state === "resolved";

  const toggleSelection = (cardId: string) => {
    setSelections((previous) => {
      if (previous.includes(cardId)) return previous.filter((id) => id !== cardId);
      if (previous.length >= 3) return previous;
      return [...previous, cardId];
    });
  };

  const lockIn = () => {
    runtime.store.getState().lockEncounterSelections(sceneId, reference, selections);
  };

  return (
    <div className="vv-scrim">
      <section
        className="vv-panel vv-encounter"
        role="dialog"
        aria-label={`Cross-reference encounter: ${crossRef.reference}`}
        data-testid="encounter-panel"
      >
        <header className="vv-encounter__header">
          <div className="vv-encounter__identity">
            {showPortrait ? (
              <img
                className="vv-portrait"
                src={`assets/portraits/${art.portraitKey}.png`}
                alt=""
                data-testid="encounter-portrait"
                onError={() => setPortraitBroken(true)}
              />
            ) : null}
            <div>
              <h2 className="vv-encounter__title">{title}</h2>
              <p className="vv-encounter__reference" data-testid="encounter-reference">
                {crossRef.reference} · illuminating {crossRef.anchor}
              </p>
            </div>
          </div>
        </header>

        {isResolved ? (
          <EncounterSummary record={record} cards={displayCards} note={crossRef.note} />
        ) : (
          <>
            <div className="vv-encounter__passages">
              <h3 className="vv-encounter__subhead">Passages</h3>
              <ScripturePassageCard
                runtime={runtime}
                label="Daniel"
                reference={anchor}
                encounterReference={reference}
                testId="passage-card-anchor"
              />
              <ScripturePassageCard
                runtime={runtime}
                label="Cross-reference"
                reference={crossRef.reference}
                encounterReference={reference}
                testId="passage-card-reference"
              />
            </div>

            {displayCards ? (
              <>
                {isFallback ? (
                  <p className="vv-placeholder-tag" data-testid="cards-fallback-notice">
                    These insight cards are a reviewed fallback set, not generated live.
                  </p>
                ) : null}
                <InsightCardGrid
                  cards={displayCards}
                  unlocked={bothRead}
                  selections={selections}
                  onToggle={toggleSelection}
                  onLock={lockIn}
                />
              </>
            ) : null}

            <p className="vv-encounter__state" data-testid="encounter-state">
              Engaged
            </p>
          </>
        )}

        {/* The one Close (PRD-14, operator request): a footer at the panel's
            bottom-right, clickable in every state, replacing the persistent
            top-right button. Quiet during selection so "Lock in your picks"
            stays the primary action; yellow once resolved, when Close is the
            only action left. */}
        <footer className="vv-encounter__footer">
          <button
            type="button"
            className={`vv-button${isResolved ? "" : " vv-button--quiet"}`}
            data-testid="encounter-close"
            onClick={() => runtime.view.getState().closeEncounter()}
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}

/**
 * One Scripture passage, collapsed behind an explicit "Read" action. The
 * read gate (storyboard-v2.md line 21) is keyed on a deliberate open, not on
 * the fetch resolving: the bundled text resolves near-instantly, so marking
 * it read on load would make the gate a no-op instead of the thing that
 * stops a player from selecting cards without having looked at the text.
 */
function ScripturePassageCard({
  runtime,
  label,
  reference,
  encounterReference,
  testId,
}: {
  runtime: AppRuntime;
  label: string;
  reference: string;
  encounterReference: string;
  testId: string;
}) {
  const isRead = useViewState((state) => hasReadPassage(state, encounterReference, reference));
  const isHighlighted = useGameState((state) => reference in state.highlights);
  const [isOpen, setIsOpen] = useState(false);
  const [passage, setPassage] = useState<PassageResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    runtime.scripture.getPassage(reference).then((result) => {
      if (!cancelled) setPassage(result);
    });
    return () => {
      cancelled = true;
    };
  }, [runtime, reference]);

  const open = () => {
    setIsOpen(true);
    runtime.view.getState().markPassageRead(encounterReference, reference);
  };

  return (
    <div className="vv-scripture-card" data-testid={testId}>
      <div className="vv-scripture-card__header">
        <p className="vv-scripture-card__label">
          {label} · {reference}
        </p>
        {isRead ? (
          <span className="vv-scripture-card__read-tag" aria-hidden="true">
            Read
          </span>
        ) : null}
      </div>
      {isOpen ? (
        <>
          <p className="vv-encounter__stub" data-testid={`${testId}-text`}>
            {passage?.status === "available"
              ? passage.text
              : (passage?.reason ?? "Loading passage…")}
          </p>
          {/* PRD-10: a deliberate player action, not an automatic consequence
              of reading — the read gate above unlocks the card grid; this
              button is the only thing that ever records a highlight. */}
          {isHighlighted ? (
            <span
              className="vv-scripture-card__highlight-tag"
              data-testid={`${testId}-highlighted`}
            >
              Highlighted
            </span>
          ) : (
            <button
              type="button"
              className="vv-button vv-button--quiet"
              data-testid={`${testId}-highlight`}
              onClick={() => highlightPassage(runtime, reference)}
            >
              Highlight verse
            </button>
          )}
        </>
      ) : (
        <button type="button" className="vv-button" data-testid={`${testId}-open`} onClick={open}>
          Read {label}
        </button>
      )}
    </div>
  );
}

/**
 * Six insight cards, locked to text-only until both passages are read
 * (storyboard-v2.md line 21) and to a selection toggle once they are. No
 * value is ever shown here — that is the reveal's job, after locking. The
 * cap is stated up front ("N of 3") and enforced by disabling further cards
 * once it is reached, so the player never discovers it via a failed click.
 */
function InsightCardGrid({
  cards,
  unlocked,
  selections,
  onToggle,
  onLock,
}: {
  cards: readonly EncounterCard[];
  unlocked: boolean;
  selections: readonly string[];
  onToggle: (cardId: string) => void;
  onLock: () => void;
}) {
  const atCap = selections.length >= 3;

  return (
    <div className="vv-encounter__cards">
      <h3 className="vv-encounter__subhead">Insight cards</h3>

      {!unlocked ? (
        <p className="vv-placeholder-tag" data-testid="cards-locked-notice">
          Read both Scripture cards above to unlock these.
        </p>
      ) : (
        <p className="vv-encounter__cap-notice" data-testid="selection-cap-notice">
          Pick the most important things you learn — up to three.{" "}
          {atCap ? "That's your three." : `Chosen so far: ${selections.length}.`}
        </p>
      )}

      <ul className="vv-card-grid" data-testid="insight-card-grid">
        {cards.map((card, index) => {
          const selected = selections.includes(card.id);
          const disabled = !unlocked || (!selected && atCap);
          return (
            <li key={card.id}>
              <button
                type="button"
                className={`vv-insight-card${selected ? " vv-insight-card--selected" : ""}`}
                data-testid={`insight-card-${index}`}
                data-selected={selected}
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onToggle(card.id)}
              >
                <span className="vv-insight-card__marker" aria-hidden="true">
                  {selected ? "✓" : ""}
                </span>
                <span className="vv-insight-card__text">{card.text}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="vv-button"
        data-testid="lock-selections"
        disabled={!unlocked}
        onClick={onLock}
      >
        Lock in your picks
      </button>
    </div>
  );
}

/**
 * The reveal, and what a revisited (or migrated v2) encounter renders
 * instead of the card grid. Reads only the persisted record — no
 * regeneration, ever (phase 1 already rejects a second `generateEncounterCards`
 * call, so this component does not need to guard against it itself).
 *
 * A v2 encounter resolved under the old free-text mechanic has no card set
 * at all (`record.cards` absent); that is a legal state (PRD-08 phase 1) and
 * renders as resolved with the curated note only, never a crash.
 */
function EncounterSummary({
  record,
  cards,
  note,
}: {
  record: EncounterRecord;
  /** The shuffled display order (PRD-14) — same deck as `record.cards`. */
  cards: readonly EncounterCard[] | undefined;
  note: string;
}) {
  return (
    <div className="vv-encounter__summary" data-testid="encounter-summary">
      <p className="vv-encounter__state" data-testid="encounter-state">
        Resolved
      </p>

      {cards ? (
        <ul className="vv-card-grid" data-testid="insight-card-grid">
          {cards.map((card, index) => {
            const selected = (record.selections ?? []).includes(card.id);
            // A high-value card the player did not choose is framed as what
            // else was worth seeing, never as a miss (ADR-0003 "never
            // punitive").
            const showAside = !selected && card.value >= 3;
            return (
              <li key={card.id}>
                <div
                  className={`vv-insight-card vv-insight-card--revealed${
                    selected ? " vv-insight-card--selected" : ""
                  }`}
                  data-testid={`insight-card-${index}`}
                  data-selected={selected}
                >
                  <span className="vv-insight-card__marker" aria-hidden="true">
                    {selected ? "✓" : ""}
                  </span>
                  <span
                    className="vv-insight-card__value"
                    data-testid={`insight-card-value-${index}`}
                  >
                    {card.value}
                  </span>
                  <span className="vv-insight-card__text">{card.text}</span>
                  {showAside ? (
                    <span className="vv-insight-card__aside">Also worth seeing.</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="vv-encounter__stub" data-testid="encounter-no-cards">
          This connection was explored before the card set existed. The record below still holds.
        </p>
      )}

      <div className="vv-encounter__note">
        <h3 className="vv-encounter__subhead">Curated note</h3>
        <p data-testid="encounter-note">{note}</p>
      </div>
    </div>
  );
}
