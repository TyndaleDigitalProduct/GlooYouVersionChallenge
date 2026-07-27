# Docs

Project documentation, split four ways so it doesn't turn into one
undifferentiated pile.

| Directory         | Contents                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `prds/`           | Product requirement docs — one per unit of work, numbered `NN_short_name.md`. The PRD loop reads these.                        |
| `prds/completed/` | PRDs whose work is finished and verified. Moved here at the end of the lifecycle.                                              |
| `decisions/`      | Architecture decision records. Numbered, short, focused on _why_. Human-authored — agents flag decisions but never write them. |
| `research/`       | External inputs: the Gloo/YouVersion challenge brief, platform API docs, prior art, versification references. Durable.         |
| `notes/`          | Working scratch: meeting notes, half-formed ideas, debugging trails. Disposable by design.                                     |

The line between `research/` and `notes/`: research is material that came from
**outside** and stays useful; notes are what **you** thought while working and
usually stop mattering once the work lands. When in doubt it's a note.

## Conventions

- **PRDs:** `NN_short_name.md`, zero-padded, sequential. Never renumber an
  existing PRD — the number appears in commit messages and branch names.
- **ADRs:** `NNNN-short-title.md`, zero-padded to four digits. An ADR is
  immutable once accepted; to change a decision, write a new ADR that supersedes
  it and note the supersession in both.
- **Research and notes:** no naming rules. Date-prefix them if it helps.
- Write in plain prose. These are read by both people and agents.

## Process

The full PRD lifecycle, quality gates, and agent constraints are in
[`../AGENTS.md`](../AGENTS.md). That file is the source of truth; this one is
just a map.
