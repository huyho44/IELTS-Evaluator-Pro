import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import {
  GradingProvider,
  ProviderFailure,
} from '../src/grading/grading-provider.js';
import {
  compareRecommendationBaselines,
  type BaselineContext,
} from '../src/evaluation/recommendation-baselines.js';
import {
  DEMO_EVALUATION_RUBRIC,
  assessPrediction,
  evaluationInput,
  summarizeEvaluation,
  validateDataset,
  validateRubric,
  type EvaluationPrediction,
} from '../src/evaluation/writing-evaluation.js';
import {
  WRITING_INSTRUCTIONS,
  WRITING_SCHEMA,
} from '../src/evaluation/writing-contract.js';

const args = process.argv.slice(2);
function option(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--'))
    throw new Error(`--${name} requires a value`);
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a JSON object');
  return value as Record<string, unknown>;
}
async function load(path: string): Promise<unknown[]> {
  const source = (await readFile(path, 'utf8')).trim();
  try {
    if (source.startsWith('[')) return JSON.parse(source) as unknown[];
    return source
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as unknown);
  } catch {
    throw new Error('Could not parse input JSON/JSONL; check file formatting');
  }
}
async function save(path: string, result: unknown) {
  await writeFile(path, JSON.stringify(result, null, 2) + '\n', {
    flag: args.includes('--overwrite') ? 'w' : 'wx',
  });
  console.log(`Evaluation artifact written: ${path}`);
}
async function main() {
  const output = option('output');
  if (!output)
    throw new Error(
      'Provide --output path; existing files are protected unless --overwrite is explicit',
    );
  const recommendationFile = option('recommendations');
  if (recommendationFile) {
    const contexts = await load(recommendationFile);
    const results = contexts.map((value) => {
      const row = object(value);
      if (
        typeof row.learnerId !== 'string' ||
        !row.criterionScores ||
        !Array.isArray(row.candidates) ||
        !Array.isArray(row.proposedIds)
      )
        throw new Error('Invalid recommendation comparison record');
      return compareRecommendationBaselines(row as unknown as BaselineContext);
    });
    await save(output, {
      evaluationType: 'POLICY_COMPARISON_NO_LEARNING_EFFECT_CLAIM',
      results,
    });
    return;
  }
  const datasetFile = option('dataset');
  if (!datasetFile)
    throw new Error(
      'Provide --dataset JSON/JSONL or --recommendations JSON/JSONL',
    );
  const dataset = validateDataset(await load(datasetFile));
  const datasetSha256 = createHash('sha256')
    .update(await readFile(datasetFile))
    .digest('hex');
  const split = option('split');
  if (split !== 'dev' && split !== 'holdout')
    throw new Error('Explicitly select --split dev or --split holdout');
  const selected = dataset.filter((row) => row.split === split);
  if (!selected.length) throw new Error('Selected split contains no rows');
  if (
    selected.some((row) => row.labelSource === 'synthetic') &&
    !args.includes('--allow-synthetic')
  )
    throw new Error(
      'Synthetic smoke examples require --allow-synthetic and do not establish accuracy',
    );
  if (new Set(selected.map((row) => row.labelSource)).size > 1)
    throw new Error('Do not mix synthetic and expert rows in one report');
  const rubricFile = option('rubric');
  const rubric = rubricFile
    ? validateRubric(JSON.parse(await readFile(rubricFile, 'utf8')) as unknown)
    : DEMO_EVALUATION_RUBRIC;
  if (selected.some((row) => row.labelSource === 'expert') && rubric.isDemo)
    throw new Error(
      'Expert evaluation requires --rubric with isDemo:false, the exact rubric used by the raters and a version identifier',
    );
  const provider =
    option('provider') ?? process.env.EVALUATION_PROVIDER ?? 'OPENAI';
  const live = args.includes('--live');
  const model =
    option('model') ?? process.env.OPENAI_MODEL ?? (live ? '' : 'offline');
  if (args.includes('--prepare-contexts')) {
    await save(output, {
      rubric: { code: rubric.code, versionNo: rubric.versionNo },
      split,
      contexts: selected.map((row) => ({
        id: row.id,
        ...evaluationInput(row, rubric, provider, model).input,
      })),
      containsStudentText: true,
      note: 'Prepared provider payloads intentionally exclude labels and rater metadata. Keep this file private.',
    });
    return;
  }
  const offlineFile = option('predictions');
  if (live === !!offlineFile)
    throw new Error(
      'Choose exactly one: --predictions file (offline) or --live (paid provider calls)',
    );
  if (live && !model)
    throw new Error('Configure --model or OPENAI_MODEL before live evaluation');
  const maxItems = Number(option('max-items') ?? 50);
  if (
    !Number.isInteger(maxItems) ||
    maxItems < 1 ||
    (live && selected.length > maxItems)
  )
    throw new Error(
      'Live split exceeds --max-items; explicitly increase the cap after checking the dataset',
    );
  const offline = new Map<string, EvaluationPrediction>();
  if (offlineFile)
    for (const value of await load(offlineFile)) {
      const row = object(value);
      if (
        typeof row.id !== 'string' ||
        offline.has(row.id) ||
        !dataset.some((d) => d.id === row.id)
      )
        throw new Error('Prediction IDs must be unique dataset IDs');
      offline.set(row.id, row as unknown as EvaluationPrediction);
    }
  const client = new GradingProvider();
  const results = [];
  for (const row of selected) {
    let prediction: EvaluationPrediction;
    if (offlineFile) {
      prediction = offline.get(row.id) ?? {
        assessment: null,
        errorCode: 'MISSING_OFFLINE_PREDICTION',
      };
    } else {
      const started = Date.now();
      try {
        const result = await client.evaluateWithMetadata(
          evaluationInput(row, rubric, provider, model).input,
        );
        prediction = {
          assessment: result.assessment,
          providerRequestId: result.providerRequestId,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs: Date.now() - started,
        };
      } catch (error) {
        prediction = {
          assessment: null,
          latencyMs: Date.now() - started,
          errorCode:
            error instanceof ProviderFailure
              ? error.code
              : 'EVALUATION_REQUEST_FAILED',
          ...(error instanceof ProviderFailure ? error.metadata : {}),
        };
      }
    }
    results.push(assessPrediction(row, prediction, rubric));
  }
  await save(output, {
    generatedAt: new Date().toISOString(),
    split,
    mode: live ? 'LIVE_PROVIDER' : 'OFFLINE_PREDICTIONS',
    provider: live ? provider : null,
    model: live ? model : null,
    promptVersion: 'writing-clinic-demo-v1',
    datasetSha256,
    promptSha256: createHash('sha256')
      .update(
        JSON.stringify({
          instructions: WRITING_INSTRUCTIONS,
          schema: WRITING_SCHEMA,
        }),
      )
      .digest('hex'),
    ...summarizeEvaluation(selected, results, rubric),
  });
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Evaluation failed');
  process.exitCode = 1;
});
