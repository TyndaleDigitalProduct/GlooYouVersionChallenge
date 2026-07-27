# 0001. Record architecture decisions

Date: 2026-07-27

## Status

Accepted

## Context

This project will accumulate decisions that are expensive to revisit and hard to
reconstruct later: the tech stack, how Scripture references are modelled, how
the curated cross-reference data maps onto game scenes, which parts of the Gloo
and YouVersion platforms we integrate with.

Agents working through the PRD loop have no memory across sessions. Without a
written record they will either re-litigate settled questions or silently make a
contradictory choice.

## Decision

We record significant decisions as ADRs in `docs/decisions/`, numbered
`NNNN-short-title.md`.

An ADR is short: context, the decision, and the consequences. It captures *why*,
not *how* — the how belongs in the code and in PRDs.

ADRs are **human-authored**. Agents do not write them. When a PRD worker makes a
call that deserves a record, it flags that in its summary and the operator
decides whether it becomes an ADR.

Once accepted, an ADR is immutable. A decision that changes gets a new ADR that
supersedes the old one, with a note added to both.

## Consequences

- Anyone joining the project, human or agent, can read the decision history in
  order and understand how the project got its shape.
- There is a small overhead per decision. That is the point; it filters out
  decisions not worth recording.
- The record is only as good as the discipline. An undocumented decision is
  indistinguishable from an accident six months later.
