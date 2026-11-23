import type {
  CriterionInput,
  FindingInput,
  ObservationInput,
  ObservationOutcome,
  ReviewDetail,
} from "./types";

type Props = {
  review: ReviewDetail;
  criteria: CriterionInput[];
  findings: FindingInput[];
  observations: ObservationInput[];
  onFindingsChange: (value: FindingInput[]) => void;
  onObservationsChange: (value: ObservationInput[]) => void;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50";

const outcomes: { value: ObservationOutcome; label: string }[] = [
  { value: "MET", label: "Demonstrated" },
  { value: "PARTIAL", label: "Partly demonstrated" },
  { value: "NOT_MET", label: "Not yet demonstrated" },
  { value: "NOT_OBSERVED", label: "Not enough evidence" },
];

export default function ReviewEvidenceEditor({
  review,
  criteria,
  findings,
  observations,
  onFindingsChange,
  onObservationsChange,
}: Props) {
  const paragraphs = review.revision.revisionParagraphs;

  function changeFinding(id: string, patch: Partial<FindingInput>) {
    onFindingsChange(
      findings.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function changeObservation(id: string, patch: Partial<ObservationInput>) {
    onObservationsChange(
      observations.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    );
  }

  return (
    <>
      <section className="space-y-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Confirm feedback and evidence
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Select only feedback you have verified. Unselected AI suggestions remain provisional.
            </p>
          </div>
          <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-800">
            {findings.filter((f) => f.approved).length} selected
          </span>
        </div>

        {findings.map((finding, findingIndex) => (
          <div
            key={finding.id}
            className={`space-y-3 rounded-xl border p-3.5 transition ${
              finding.approved
                ? "border-brand-200 bg-brand-50/20"
                : "border-slate-200 bg-slate-50/50"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={finding.approved}
                  onChange={(event) =>
                    changeFinding(finding.id, { approved: event.target.checked })
                  }
                  className="size-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
                />
                <span>Include feedback {findingIndex + 1}</span>
              </label>
              <button
                type="button"
                className="text-xs font-medium text-rose-700 hover:underline"
                onClick={() =>
                  onFindingsChange(
                    findings.filter((item) => item.id !== finding.id),
                  )
                }
              >
                Discard
              </button>
            </div>

            {!finding.approved && (
              <p className="whitespace-pre-wrap text-xs text-slate-600">
                {finding.explanation}
              </p>
            )}

            {finding.approved && (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-slate-700">
                    Criterion
                    <select
                      required
                      value={finding.code}
                      onChange={(event) =>
                        changeFinding(finding.id, { code: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Choose a criterion</option>
                      {criteria.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-700">
                    Observation type
                    <select
                      required
                      value={finding.kind}
                      onChange={(event) =>
                        changeFinding(finding.id, {
                          kind: event.target.value as FindingInput["kind"],
                        })
                      }
                      className={inputClass}
                    >
                      <option value="">Choose a type</option>
                      <option value="LOCAL">Specific passage</option>
                      <option value="GLOBAL">Whole response</option>
                    </select>
                  </label>
                </div>

                <label className="block space-y-1 text-xs font-medium text-slate-700">
                  Feedback explanation
                  <textarea
                    required
                    rows={2}
                    maxLength={10000}
                    value={finding.explanation}
                    onChange={(event) =>
                      changeFinding(finding.id, {
                        explanation: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>

                <label className="block space-y-1 text-xs font-medium text-slate-700">
                  Related skill (optional)
                  <select
                    value={finding.skillId}
                    onChange={(event) =>
                      changeFinding(finding.id, { skillId: event.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">No skill tag</option>
                    {review.availableSkills.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name}
                      </option>
                    ))}
                  </select>
                </label>

                {finding.anchors.map((anchor, index) => {
                  const selectedParagraph = paragraphs.find(
                    (p) => p.id === anchor.paragraphId,
                  );
                  const trimmedQuote = anchor.exactQuote.trim();
                  const quoteMatches =
                    Boolean(selectedParagraph) &&
                    Boolean(trimmedQuote) &&
                    selectedParagraph!.text.includes(trimmedQuote);

                  return (
                    <div
                      key={`${finding.id}-${index}`}
                      className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Evidence quotation #{index + 1}
                        </span>
                        <button
                          type="button"
                          className="text-xs font-medium text-rose-700 hover:underline"
                          onClick={() =>
                            changeFinding(finding.id, {
                              anchors: finding.anchors.filter(
                                (_, position) => position !== index,
                              ),
                            })
                          }
                        >
                          Remove quotation
                        </button>
                      </div>

                      <label className="block space-y-1 text-xs font-medium text-slate-700">
                        Evidence paragraph
                        <select
                          required
                          value={anchor.paragraphId}
                          onChange={(event) =>
                            changeFinding(finding.id, {
                              anchors: finding.anchors.map((item, position) =>
                                position === index
                                  ? { ...item, paragraphId: event.target.value }
                                  : item,
                              ),
                            })
                          }
                          className={inputClass}
                        >
                          <option value="">Choose a paragraph</option>
                          {paragraphs.map((paragraph) => (
                            <option key={paragraph.id} value={paragraph.id}>
                              Paragraph P{paragraph.paragraphNo}
                            </option>
                          ))}
                        </select>
                      </label>

                      {selectedParagraph && (
                        <div className="rounded-md border border-slate-100 bg-slate-50 p-2 text-xs text-slate-600">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700">
                              P{selectedParagraph.paragraphNo} text
                            </span>
                            {!trimmedQuote && (
                              <button
                                type="button"
                                onClick={() =>
                                  changeFinding(finding.id, {
                                    anchors: finding.anchors.map(
                                      (item, position) =>
                                        position === index
                                          ? {
                                              ...item,
                                              exactQuote:
                                                selectedParagraph.text,
                                            }
                                          : item,
                                    ),
                                  })
                                }
                                className="font-semibold text-brand-700 hover:underline"
                              >
                                Copy P{selectedParagraph.paragraphNo}
                              </button>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-3 italic">
                            {selectedParagraph.text}
                          </p>
                        </div>
                      )}

                      <label className="block space-y-1 text-xs font-medium text-slate-700">
                        Exact quotation
                        <textarea
                          required
                          rows={2}
                          maxLength={10000}
                          value={anchor.exactQuote}
                          onChange={(event) =>
                            changeFinding(finding.id, {
                              anchors: finding.anchors.map((item, position) =>
                                position === index
                                  ? { ...item, exactQuote: event.target.value }
                                  : item,
                              ),
                            })
                          }
                          className={inputClass}
                        />
                      </label>

                      {selectedParagraph && trimmedQuote && (
                        <p
                          className={`text-[11px] font-semibold ${
                            quoteMatches ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {quoteMatches
                            ? `Exact quote verified in P${selectedParagraph.paragraphNo}`
                            : `Quote does not match P${selectedParagraph.paragraphNo} verbatim`}
                        </p>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  disabled={finding.anchors.length >= 20 || !paragraphs.length}
                  className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
                  onClick={() =>
                    changeFinding(finding.id, {
                      anchors: [
                        ...finding.anchors,
                        {
                          paragraphId: paragraphs[0]?.id ?? "",
                          exactQuote: "",
                        },
                      ],
                    })
                  }
                >
                  + Add evidence quotation
                </button>
              </>
            )}
          </div>
        ))}

        <button
          type="button"
          disabled={findings.length >= 100}
          className="rounded-lg border border-brand-200 bg-brand-50/40 px-3 py-2 text-xs font-semibold text-brand-800 transition hover:bg-brand-50 disabled:opacity-50"
          onClick={() =>
            onFindingsChange([
              ...findings,
              {
                id: crypto.randomUUID(),
                approved: true,
                code: criteria[0]?.code ?? "",
                kind: "GLOBAL",
                explanation: "",
                skillId: "",
                anchors: [],
              },
            ])
          }
        >
          Add instructor feedback
        </button>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Skill observations
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Record only skills you evaluated from this response. Band scores do not automatically confirm a skill.
            </p>
          </div>
          {observations.length > 0 && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              {observations.filter((o) => o.approved).length} recorded
            </span>
          )}
        </div>

        {!observations.length && (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            No published skills are available for this assessment.
          </p>
        )}

        {observations.map((observation) => {
          const skill = review.availableSkills.find(
            (item) => item.id === observation.skillId,
          );
          return (
            <div
              key={observation.id}
              className={`space-y-2 rounded-xl border p-3 transition ${
                observation.approved
                  ? "border-brand-200 bg-brand-50/20"
                  : "border-slate-200 bg-white"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={observation.approved}
                  onChange={(event) =>
                    changeObservation(observation.id, {
                      approved: event.target.checked,
                    })
                  }
                  className="mt-0.5 size-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
                />
                <span>{skill?.name ?? "Unavailable skill"}</span>
              </label>
              {skill?.description && (
                <p className="text-xs text-slate-500">{skill.description}</p>
              )}
              {observation.approved && (
                <>
                  <label className="block space-y-1 text-xs font-medium text-slate-700">
                    Observed outcome
                    <select
                      value={observation.outcome}
                      onChange={(event) =>
                        changeObservation(observation.id, {
                          outcome: event.target.value as ObservationOutcome,
                        })
                      }
                      className={inputClass}
                    >
                      {outcomes.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1 text-xs font-medium text-slate-700">
                    Evidence for this observation
                    <textarea
                      required
                      rows={2}
                      maxLength={10000}
                      value={observation.rationale}
                      onChange={(event) =>
                        changeObservation(observation.id, {
                          rationale: event.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </label>
                </>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
