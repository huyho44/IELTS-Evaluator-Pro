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
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50";
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
      <section className="space-y-3 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-bold text-gray-900">
          Confirm feedback and evidence
        </h3>
        <p className="text-xs leading-relaxed text-gray-600">
          Select only feedback you have checked. Unselected AI suggestions
          remain provisional.
        </p>
        {findings.map((finding, findingIndex) => (
          <div
            key={finding.id}
            className="space-y-3 rounded-lg border border-gray-200 p-3"
          >
            <label className="flex items-start gap-2 text-sm font-semibold text-gray-800">
              <input
                type="checkbox"
                checked={finding.approved}
                onChange={(event) =>
                  changeFinding(finding.id, { approved: event.target.checked })
                }
              />
              <span>Include feedback {findingIndex + 1}</span>
            </label>
            {!finding.approved && (
              <p className="whitespace-pre-wrap text-xs text-gray-600">
                {finding.explanation}
              </p>
            )}
            <button
              type="button"
              className="text-xs text-red-700"
              onClick={() =>
                onFindingsChange(
                  findings.filter((item) => item.id !== finding.id),
                )
              }
            >
              Discard from this decision
            </button>
            {finding.approved && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs">
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
                  <label className="space-y-1 text-xs">
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
                <label className="block space-y-1 text-xs">
                  Feedback
                  <textarea
                    required
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
                <label className="block space-y-1 text-xs">
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
                {finding.anchors.map((anchor, index) => (
                  <div
                    key={`${finding.id}-${index}`}
                    className="space-y-2 rounded-lg bg-slate-50 p-2"
                  >
                    <label className="block space-y-1 text-xs">
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
                        {review.revision.revisionParagraphs.map((paragraph) => (
                          <option key={paragraph.id} value={paragraph.id}>
                            Paragraph {paragraph.paragraphNo}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1 text-xs">
                      Exact quotation
                      <textarea
                        required
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
                    <button
                      type="button"
                      className="text-xs text-red-700"
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
                ))}
                <button
                  type="button"
                  disabled={finding.anchors.length >= 20}
                  className="text-xs font-semibold text-blue-600 disabled:opacity-50"
                  onClick={() =>
                    changeFinding(finding.id, {
                      anchors: [
                        ...finding.anchors,
                        {
                          paragraphId:
                            review.revision.revisionParagraphs[0]?.id ?? "",
                          exactQuote: "",
                        },
                      ],
                    })
                  }
                >
                  Add evidence quotation
                </button>
              </>
            )}
          </div>
        ))}
        <button
          type="button"
          disabled={findings.length >= 100}
          className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50"
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
      <section className="space-y-3 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-bold text-gray-900">Skill observations</h3>
        <p className="text-xs leading-relaxed text-gray-600">
          Record only skills you evaluated from this response. Band scores do
          not automatically confirm a skill.
        </p>
        {!observations.length && (
          <p className="text-xs text-gray-500">
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
              className="space-y-2 rounded-lg border border-gray-200 p-3"
            >
              <label className="flex items-start gap-2 text-sm font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={observation.approved}
                  onChange={(event) =>
                    changeObservation(observation.id, {
                      approved: event.target.checked,
                    })
                  }
                />
                <span>{skill?.name ?? "Unavailable skill"}</span>
              </label>
              {skill?.description && (
                <p className="text-xs text-gray-500">{skill.description}</p>
              )}
              {observation.approved && (
                <>
                  <label className="block space-y-1 text-xs">
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
                  <label className="block space-y-1 text-xs">
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
