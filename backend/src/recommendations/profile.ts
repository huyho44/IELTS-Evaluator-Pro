export type EvidenceRow = {
  id: string;
  skillId: string;
  attemptId: string;
  revisionNo: number;
  outcome: 'MET' | 'PARTIAL' | 'NOT_MET' | 'NOT_OBSERVED';
};
export function projectSkills(rows: EvidenceRow[], skillIds: string[]) {
  const latest = new Map<string, EvidenceRow>();
  for (const row of rows) {
    const key = row.attemptId + ':' + row.skillId,
      previous = latest.get(key);
    if (!previous || row.revisionNo > previous.revisionNo) latest.set(key, row);
  }
  const evidence = [...latest.values()];
  const states = skillIds.map((skillId) => {
    const observed = evidence.filter(
      (e) => e.skillId === skillId && e.outcome !== 'NOT_OBSERVED',
    );
    const evidenceCount = observed.length;
    return {
      skillId,
      evidenceCount,
      strength: evidenceCount
        ? observed.reduce(
            (s, e) =>
              s + (e.outcome === 'MET' ? 1 : e.outcome === 'PARTIAL' ? 0.5 : 0),
            0,
          ) / evidenceCount
        : null,
      support: Math.min(evidenceCount / 3, 1),
      observationStatus:
        evidenceCount === 0
          ? ('UNKNOWN' as const)
          : evidenceCount < 3
            ? ('INSUFFICIENT' as const)
            : ('OBSERVED' as const),
    };
  });
  return { evidence, states };
}
