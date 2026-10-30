import 'dotenv/config';
import assert from 'node:assert/strict';

const base = process.env.MVP_API_URL ?? 'http://127.0.0.1:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Use a local seeded MVP API');
const sessions = {};
async function request(path, token, body) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, value: await response.json() };
}
try {
  assert.equal((await request('/health')).status, 200);
  for (const name of ['student.an', 'teacher', 'admin']) {
    const result = await request('/auth/login', null, {
      email: `${name}@ielts.example`,
      password: process.env.DEMO_PASSWORD ?? 'IeltsDemo123!',
    });
    if (result.value.accessToken) sessions[name] = result.value;
    assert.equal(result.status, 200, `Seed account login: ${name}`);
  }
  const token = (name) => sessions[name].accessToken;
  const learner = token('student.an'),
    teacher = token('teacher'),
    admin = token('admin');
  const checks = await Promise.all([
    request('/me/skills', learner),
    request('/me/recommendations', learner),
    request('/teacher/reviews?status=CONFIRMED', teacher),
    request('/authoring/catalog', teacher),
    request('/admin/users', admin),
    request('/grading/report', teacher),
    request('/grading/report', learner),
    request('/grading/templates/writing-task-2', teacher),
    request('/notifications', learner),
    request(
      '/courses/30102026-0000-4000-8000-000000000001/assignments',
      learner,
    ),
  ]);
  assert.deepEqual(
    checks.map((r) => r.status),
    [200, 200, 200, 200, 200, 200, 403, 200, 200, 200],
  );
  assert.ok(
    checks[0].value.skills.some((s) => s.code === 'demo.writing.position'),
  );
  assert.ok(
    checks[3].value.courses.some(
      (c) => c.id === '30102026-0000-4000-8000-000000000001',
    ),
  );
  assert.equal(checks[5].value.scope, 'ASSIGNED_COURSES');
  assert.equal(checks[7].value.criteria.length, 4);
  assert.equal(checks[9].value.length, 6);
  assert.ok(
    checks[1].value.recommendedActivities.every(
      (item) =>
        item.learningItem &&
        (item.learningItem.kind === 'LESSON' ||
          item.targetAssignmentVersion?.assignmentId),
    ),
  );
  console.log(
    JSON.stringify({
      httpChecks: 11,
      accounts: 3,
      writingAssignments: 6,
      recommendations: checks[1].value.recommendedActivities.length,
      learnerReportDenied: true,
      passed: true,
    }),
  );
} finally {
  for (const session of Object.values(sessions))
    await request('/auth/logout', session.accessToken, {});
}
