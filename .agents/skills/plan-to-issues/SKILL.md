---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Use the shape below. Ask the human only about what it does not cover.
5. Create each issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --body-file <tmp.md>
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

## What every issue carries

This is the shape ADR 0004 leaves to the repo. It holds for issues on GitHub and for issues as
files.

**Title:** what the work produces, not the plan's wording. `Digest page: GET /digest/:night`.

**Label:** one label per plan, `plan:<plan slug>`, taken from the plan file name. Every issue from
that plan carries it and nothing else. It is how a reader finds the whole split later, after the
plan has moved to `docs/plans/done/`.

**Body:** the first line cites the plan section, then three headings, in this order:

```md
Source: plan.md § 2a

## Scope

<what to change, which files, which cases. Name a constraint a worker cannot guess.>

## Done when

<what a reader can run or see. No "it works".>

## Blocked by

#1
```

- `Source:` is the first line, before any heading. The section number is the plan's own, so a
  reader can go back to the sentence the work came from.
- `## Blocked by` lists real issue numbers, which is why step 5 creates issues in dependency
  order. Nothing blocks it: write `nothing`.
- No other headings. A worker reads three.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
