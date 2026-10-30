# Writing Clinic evaluation protocol

The repository supplies reproducible evaluation tooling, not expert labels or evidence that AI meets the proposed accuracy target. The included tiny essays, scores and recommendation IDs are explicitly **synthetic smoke fixtures**. They test plumbing only. Do not put their output in an accuracy table or use them to claim band improvement.

Run commands below from `backend`. The runner does not connect to PostgreSQL or change learner records. Offline mode never calls an AI provider. Output files are created without overwriting existing files; add `--overwrite` only when intentional.

## 1. Verify the offline pipeline

```powershell
npx tsx scripts/evaluate-writing.ts --dataset src/evaluation/fixtures/synthetic-writing.jsonl --predictions src/evaluation/fixtures/synthetic-predictions.jsonl --split dev --allow-synthetic --output synthetic-dev-report.json
npx tsx scripts/evaluate-writing.ts --dataset src/evaluation/fixtures/synthetic-writing.jsonl --predictions src/evaluation/fixtures/synthetic-predictions.jsonl --split holdout --allow-synthetic --output synthetic-holdout-report.json
npx tsx scripts/evaluate-writing.ts --recommendations src/evaluation/fixtures/synthetic-recommendations.jsonl --output synthetic-policy-comparison.json
npx vitest run src/evaluation
```

The report must identify `SYNTHETIC_SMOKE_TEST_NOT_ACCURACY_EVIDENCE`. Missing usage/latency and evidence with no anchors are reported as unknown or null, not as measured zeros or perfect validity.

## 2. Prepare independent labels

Use UTF-8 JSONL (one object per line) or a JSON array. Replace every placeholder with actual study data; the following is a template, not a valid labeled example:

```json
{
  "id": "unique-essay-id",
  "split": "holdout",
  "opportunityGroup": "same-original-prompt-and-revisions-group",
  "labelSource": "expert",
  "raterId": "pseudonymous-rater-id",
  "task": "actual Task 2 question",
  "text": "actual consented essay",
  "labels": {
    "overall": "REPLACE_WITH_NUMERIC_EXPERT_BAND",
    "criteria": {
      "TR": "REPLACE",
      "CC": "REPLACE",
      "LR": "REPLACE",
      "GRA": "REPLACE"
    }
  }
}
```

Record the rubric/version used by independent qualified raters, agreement/adjudication procedure, provenance/permission to use the essays, and inclusion criteria in the study report. Keep revisions of one opportunity in one split. The loader rejects duplicate IDs and any `opportunityGroup` appearing in both dev and holdout. It cannot detect deliberately mislabeled groups; audit the source dataset too. Do not use held-out labels or examples to tune prompts. Freeze model, prompt and rubric versions before running holdout. A small initial 20–30 essay set and MAE <=0.5 remain a proposed target, not an achieved guarantee.

Provide the actual rater rubric as JSON with `code`, positive integer `versionNo`, `isDemo:false`, and exactly four `criteria`: `code` (TR/CC/LR/GRA), `name`, `definition`, positive `weight`, `maxScore:9`, and optionally `bandDescriptors`. The supplied demo teaching rubric is refused for expert-label evaluation. Do not set `isDemo:false` merely to bypass this check; attach the reviewed scoring specification used by the raters. Protect all essay/label/context files and keep them out of Git.

## 3. Evaluate saved outputs or a configured provider

Prepare provider contexts before collecting external outputs. These contain student text, but deliberately exclude expert labels, split and rater metadata:

```powershell
npx tsx scripts/evaluate-writing.ts --dataset private/essays.jsonl --rubric private/rater-rubric.json --split dev --prepare-contexts --output private/dev-contexts.json
```

Saved prediction JSONL uses `{ "id": "essay-id", "assessment": { "summary": "...", "criteria": [...], "findings": [...] } }`. Preserve the paragraph IDs in prepared contexts. Optional measured fields: `latencyMs`, `providerRequestId`, `inputTokens`, `outputTokens`; use `errorCode` for failed requests. Missing predictions count as failures rather than shrinking the denominator.

```powershell
npx tsx scripts/evaluate-writing.ts --dataset private/essays.jsonl --rubric private/rater-rubric.json --predictions private/predictions.jsonl --split holdout --output private/holdout-report.json
```

Only `--live` invokes the configured provider and may incur charges. Configure the server-side provider credentials described in the setup guide and supply the exact supported model name; no model is invented by the runner. No live request has been made as part of the included smoke tests.

```powershell
npx tsx scripts/evaluate-writing.ts --dataset private/essays.jsonl --rubric private/rater-rubric.json --split dev --live --provider OPENAI --model YOUR_CONFIGURED_MODEL --max-items 30 --output private/live-dev-report.json
```

`JSON_HTTP` is also supported through `GRADING_PROVIDER_URL`. One request is made per selected essay; failed requests are recorded and not silently retried. A default cap of 50 live items limits accidental large runs. The backend's normal grading worker has its own retry policy; report this methodological difference.

Outputs include MAE per criterion and overall; large errors >1 overall band; attempted/valid/invalid coverage; exact-quote anchor validity; mean/p95 latency when measured; token counts and missing-usage counts. Each response is passed through the same backend assessment validator. MAE includes only valid outputs, so always report failure coverage alongside MAE. Anchor existence does not establish that a finding is pedagogically correct. Expert review of finding relevance/correctness and teacher effort needs a separate recorded study. Dollar costs require the actual provider pricing and billing data; token counts alone do not invent a cost.

## 4. Compare recommendation policies

Export one JSONL record per learner with `learnerId`, `criterionScores`, `candidates`, and `proposedIds`. Each candidate has `id`, curriculum `position`, mapped `criteria`, and `eligible` from the same current access/publication/prerequisite/time/quota snapshot. `proposedIds` must be actual recommendation IDs exported from the implemented policy, not hand-picked favorable recommendations. Optional `expertRelevantIds` contains external relevance judgments collected independently.

The runner computes two explicit baselines: (1) first three eligible items by fixed curriculum order; (2) first eligible items mapped to the lowest criterion, with deterministic TR/CC/LR/GRA tie breaking. The latter intentionally uses coarse criterion bands, unlike the evidence-based proposed policy. It reports choices/explanations, overlap, invalid proposed targets and relevance precision only when labels are supplied. No improvement/completion probabilities or learning gains are simulated. The synthetic example hand-picks different proposed IDs solely to test report formatting; it does not demonstrate that the real policy differentiates learners.

## Acceptance evidence still requiring external work

- Collect and review real expert labels, freeze development and held-out groups, and run a paid provider only with configured credentials.
- Report AI accuracy before teacher review separately from accepted teacher decisions; compare the same model/rubric under a declared simple structured-prompt baseline.
- Collect teacher judgments of finding correctness and recommendation relevance; measure actual review time/errors found with a declared control and budget.
- Run the Task 2 -> accepted observations -> targeted practice -> revision -> independent new-topic transfer scenario with actual participants if making a learning claim.
- Preserve logs/report artifacts and document failures, model/prompt versions, sample limitations and any excluded responses. Passing synthetic tests or a UI demonstration alone does not satisfy experimental evaluation.
