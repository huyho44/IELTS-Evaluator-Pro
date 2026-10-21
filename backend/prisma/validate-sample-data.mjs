import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only validation of full database-row examples, not Prisma create inputs.
// Deliberately reads the current schema: runtime Prisma.dmmf omits constraints.
// This is a parser for the PSL constructs used by this project, not a replacement
// for `prisma validate` or the application's cross-table business rules.
const scalarTypes = new Set([
  'String',
  'Boolean',
  'Int',
  'BigInt',
  'Float',
  'Decimal',
  'DateTime',
  'Json',
  'Bytes',
]);

function fail(message) {
  throw new Error(message);
}

function stripComments(source) {
  let output = '';
  let quote = false;
  let escaped = false;
  for (let i = 0; i < source.length; i += 1) {
    const character = source[i];
    if (quote) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quote = false;
    } else if (character === '"') {
      quote = true;
      output += character;
    } else if (character === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      output += '\n';
    } else if (character === '/' && source[i + 1] === '*') {
      i += 2;
      while (
        i < source.length &&
        !(source[i] === '*' && source[i + 1] === '/')
      ) {
        output += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i >= source.length) fail('Schema contains an unterminated comment.');
      i += 1;
    } else output += character;
  }
  if (quote) fail('Schema contains an unterminated string.');
  return output;
}

function balanced(source, start, opening = '(', closing = ')') {
  if (source[start] !== opening) fail(`Expected ${opening} in schema.`);
  let depth = 0;
  let quote = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const character = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quote = false;
      continue;
    }
    if (character === '"') quote = true;
    else if (character === opening) depth += 1;
    else if (character === closing) {
      depth -= 1;
      if (depth === 0) return { value: source.slice(start + 1, i), end: i + 1 };
    }
  }
  fail(`Unclosed ${opening} in schema.`);
}

function statements(body) {
  const result = [];
  let start = 0;
  let depth = 0;
  let quote = false;
  let escaped = false;
  for (let i = 0; i <= body.length; i += 1) {
    const character = body[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quote = false;
      continue;
    }
    if (character === '"') quote = true;
    else if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    else if ((character === '\n' || i === body.length) && depth === 0) {
      const statement = body.slice(start, i).trim();
      if (statement) result.push(statement);
      start = i + 1;
    }
    if (depth < 0) fail('Unbalanced schema statement.');
  }
  if (depth !== 0 || quote) fail('Unbalanced schema statement.');
  return result;
}

function attributes(source) {
  const result = new Map();
  let position = 0;
  while (position < source.length) {
    while (/\s/.test(source[position] ?? '') && position < source.length)
      position += 1;
    if (position === source.length) break;
    const match = /^(@@?[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?)/.exec(
      source.slice(position),
    );
    if (!match) fail('Unsupported attribute syntax in schema.');
    const name = match[1];
    position += name.length;
    while (/\s/.test(source[position] ?? '') && position < source.length)
      position += 1;
    let value = '';
    if (source[position] === '(') {
      const parsed = balanced(source, position);
      value = parsed.value;
      position = parsed.end;
    }
    if (result.has(name)) fail(`Duplicate ${name} attribute in schema.`);
    result.set(name, value);
  }
  return result;
}

function fieldList(source, context) {
  const opening = source.indexOf('[');
  if (opening < 0) fail(`Missing field list for ${context}.`);
  const body = balanced(source, opening, '[', ']').value;
  const names = body
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length || names.some((name) => !/^[A-Za-z_]\w*$/.test(name))) {
    fail(
      `Unsupported field list for ${context}; update the checker for this PSL syntax.`,
    );
  }
  return names;
}

export function parseSchema(rawSchema) {
  const source = stripComments(rawSchema.toString('utf8'));
  const models = new Map();
  const enums = new Map();
  const block = /^\s*(model|enum)\s+([A-Za-z_]\w*)\s*\{/gm;
  let match;
  while ((match = block.exec(source))) {
    const opening = source.indexOf('{', match.index);
    const parsed = balanced(source, opening, '{', '}');
    block.lastIndex = parsed.end;
    const [, kind, name] = match;
    if (models.has(name) || enums.has(name))
      fail(`Duplicate schema type ${name}.`);
    const lines = statements(parsed.value);
    if (kind === 'enum') {
      const values = [];
      for (const line of lines) {
        if (line.startsWith('@@')) continue;
        const value = /^([A-Za-z_]\w*)(?:\s+@map\("(?:\\.|[^"\\])*"\))?$/.exec(
          line,
        );
        if (!value) fail(`Unsupported enum syntax in ${name}.`);
        if (values.includes(value[1])) fail(`Duplicate value in enum ${name}.`);
        values.push(value[1]);
      }
      enums.set(name, values);
      continue;
    }
    const model = { name, fields: new Map(), keys: [], relations: [] };
    for (const line of lines) {
      if (line.startsWith('@@')) {
        const attrs = attributes(line);
        for (const key of ['@@id', '@@unique']) {
          if (attrs.has(key))
            model.keys.push({
              fields: fieldList(attrs.get(key), `${name}.${key}`),
              primary: key === '@@id',
            });
        }
        continue;
      }
      const field =
        /^([A-Za-z_]\w*)\s+(Unsupported\("(?:\\.|[^"\\])*"\)|[A-Za-z_]\w*)(\?|\[\])?(?:\s+([\s\S]*))?$/.exec(
          line,
        );
      if (!field) fail(`Unsupported field syntax in model ${name}.`);
      const [, fieldName, type, modifier = '', suffix = ''] = field;
      if (model.fields.has(fieldName))
        fail(`Duplicate field ${name}.${fieldName}.`);
      const attrs = attributes(suffix);
      const entry = {
        name: fieldName,
        type,
        nullable: modifier === '?',
        list: modifier === '[]',
        attrs,
        unsupported: type.startsWith('Unsupported('),
      };
      model.fields.set(fieldName, entry);
      if (attrs.has('@id') || attrs.has('@unique')) {
        model.keys.push({ fields: [fieldName], primary: attrs.has('@id') });
      }
    }
    models.set(name, model);
  }
  if (!models.size) fail('No models found in current Prisma schema.');
  for (const model of models.values()) {
    for (const field of model.fields.values()) {
      field.relation = models.has(field.type);
      if (field.relation) {
        const relation = field.attrs.get('@relation');
        if (!relation || !/\bfields\s*:/.test(relation)) continue;
        const fromSource = /\bfields\s*:/.exec(relation);
        const toSource = /\breferences\s*:/.exec(relation);
        if (!toSource)
          fail(`Missing references for ${model.name}.${field.name}.`);
        const from = fieldList(
          relation.slice(fromSource.index),
          `${model.name}.${field.name}.fields`,
        );
        const to = fieldList(
          relation.slice(toSource.index),
          `${model.name}.${field.name}.references`,
        );
        if (from.length !== to.length)
          fail(`Different FK tuple lengths at ${model.name}.${field.name}.`);
        model.relations.push({
          name: field.name,
          target: field.type,
          from,
          to,
        });
      } else if (
        !scalarTypes.has(field.type) &&
        !enums.has(field.type) &&
        !field.unsupported
      ) {
        fail(
          `Unknown scalar type ${model.name}.${field.name}; update the checker.`,
        );
      }
    }
    if (!model.keys.some((key) => key.primary))
      fail(`No primary key in ${model.name}.`);
    for (const key of model.keys) {
      if (
        key.fields.some(
          (name) => !model.fields.has(name) || model.fields.get(name).relation,
        )
      ) {
        fail(`Invalid key definition in ${model.name}.`);
      }
    }
  }
  for (const model of models.values()) {
    for (const relation of model.relations) {
      const target = models.get(relation.target);
      relation.from.forEach((name, index) => {
        const from = model.fields.get(name);
        const to = target.fields.get(relation.to[index]);
        if (
          !from ||
          !to ||
          from.relation ||
          to.relation ||
          from.type !== to.type
        ) {
          fail(`Invalid FK definition at ${model.name}.${relation.name}.`);
        }
      });
      if (
        !target.keys.some(
          (key) => key.fields.join(',') === relation.to.join(','),
        )
      ) {
        fail(
          `FK ${model.name}.${relation.name} does not reference a declared unique tuple.`,
        );
      }
    }
  }
  return {
    models,
    enums,
    sha256: createHash('sha256').update(rawSchema).digest('hex'),
  };
}

function validDate(value, dateOnlyAllowed) {
  if (typeof value !== 'string') return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2}))?$/.exec(
      value,
    );
  if (!match || (!match[4] && !dateOnlyAllowed)) return false;
  const [, year, month, day, hour, minute, second, timezone] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
  )
    return false;
  if (hour && (+hour > 23 || +minute > 59 || +second > 59)) return false;
  if (timezone && timezone !== 'Z') {
    const [zoneHour, zoneMinute] = timezone.slice(1).split(':').map(Number);
    if (
      zoneHour > 14 ||
      zoneMinute > 59 ||
      (zoneHour === 14 && zoneMinute !== 0)
    )
      return false;
  }
  return Number.isFinite(Date.parse(value));
}

function validateValue(field, value, schema) {
  if (value === null) return field.nullable ? null : 'must not be null';
  if (field.list) {
    if (!Array.isArray(value)) return 'must be an array';
    for (const item of value) {
      const error = validateValue(
        { ...field, list: false, nullable: false },
        item,
        schema,
      );
      if (error) return `contains a value that ${error}`;
    }
    return null;
  }
  if (field.unsupported)
    return 'uses an unsupported database type; the example must use null';
  if (schema.enums.has(field.type)) {
    return schema.enums.get(field.type).includes(value)
      ? null
      : `must be a member of enum ${field.type}`;
  }
  switch (field.type) {
    case 'String': {
      if (typeof value !== 'string') return 'must be a string';
      if (
        field.attrs.has('@db.Uuid') &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value,
        )
      ) {
        return 'must be a standard UUID';
      }
      const size =
        field.attrs.get('@db.VarChar') ?? field.attrs.get('@db.Char');
      if (size && [...value].length > Number(size))
        return `exceeds the native string limit (${size})`;
      return null;
    }
    case 'Boolean':
      return typeof value === 'boolean' ? null : 'must be a boolean';
    case 'Int':
      return Number.isInteger(value) &&
        value >= -2147483648 &&
        value <= 2147483647
        ? null
        : 'must be a 32-bit integer';
    case 'Float':
      return typeof value === 'number' && Number.isFinite(value)
        ? null
        : 'must be a finite number';
    case 'BigInt': {
      if (typeof value !== 'string' || !/^-?\d+$/.test(value))
        return 'must be an integer encoded as a JSON string';
      const integer = BigInt(value);
      return integer >= -(2n ** 63n) && integer < 2n ** 63n
        ? null
        : 'exceeds PostgreSQL bigint range';
    }
    case 'Decimal': {
      if (
        typeof value !== 'string' ||
        !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
      )
        return 'must be a decimal encoded as a JSON string';
      const native = field.attrs.get('@db.Decimal');
      if (native) {
        const [precision, scale] = native.split(',').map(Number);
        const [integer, fraction = ''] = value.replace(/^-/, '').split('.');
        const integerDigits = integer.replace(/^0+/, '').length;
        if (integerDigits > precision - scale || fraction.length > scale)
          return `exceeds Decimal(${precision}, ${scale}) precision/scale`;
      }
      return null;
    }
    case 'DateTime':
      return validDate(value, field.attrs.has('@db.Date'))
        ? null
        : 'must be a valid ISO date/time with timezone (native Date also permits YYYY-MM-DD)';
    case 'Bytes':
      return typeof value === 'string' &&
        Buffer.from(value, 'base64').toString('base64') === value
        ? null
        : 'must be canonical base64';
    case 'Json':
      return null; // JSON.parse already establishes JSON compatibility.
    default:
      return 'has an unhandled scalar type';
  }
}

function canonical(field, value) {
  if (field.type === 'Decimal') {
    let normalized = value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    if (/^-?0$/.test(normalized)) normalized = '0';
    return normalized;
  }
  if (field.type === 'BigInt') return BigInt(value).toString();
  if (field.type === 'DateTime') return new Date(value).toISOString();
  if (field.attrs.has('@db.Uuid')) return value.toLowerCase();
  return value;
}

export function validateFixture(payload, schema) {
  const violations = [];
  const add = (location, rule) => violations.push({ path: location, rule });
  const tables = payload?.tables;
  if (!tables || typeof tables !== 'object' || Array.isArray(tables)) {
    return {
      ok: false,
      violations: [
        {
          path: 'tables',
          rule: 'must be an object keyed by current Prisma model name',
        },
      ],
    };
  }
  if (payload.metadata?.schemaSha256 !== schema.sha256) {
    add(
      'metadata.schemaSha256',
      'must equal SHA-256 of the current raw schema.prisma file',
    );
  }
  for (const name of Object.keys(tables)) {
    if (!schema.models.has(name)) add(`tables.${name}`, 'unknown Prisma model');
  }
  const validRows = new Map();
  let rowCount = 0;
  let scalarValueCount = 0;
  let populatedModels = 0;
  let foreignKeyChecks = 0;
  let nullableForeignKeysSkipped = 0;
  let uniqueTupleChecks = 0;
  let uniqueConstraints = 0;
  const indexes = new Map();
  for (const model of schema.models.values()) {
    const tablePath = `tables.${model.name}`;
    const rows = tables[model.name];
    if (!Array.isArray(rows)) {
      add(tablePath, 'missing model or value is not an array');
      validRows.set(model.name, []);
      continue;
    }
    if (!rows.length) add(tablePath, 'must contain at least one example row');
    else populatedModels += 1;
    rowCount += rows.length;
    const checkedRows = [];
    const scalarFields = [...model.fields.values()].filter(
      (field) => !field.relation,
    );
    rows.forEach((row, index) => {
      const rowPath = `${tablePath}[${index}]`;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        add(rowPath, 'must be a plain JSON object');
        return;
      }
      const invalid = new Set();
      for (const name of Object.keys(row)) {
        const field = model.fields.get(name);
        if (!field) add(`${rowPath}.${name}`, 'unknown model field');
        else if (field.relation)
          add(
            `${rowPath}.${name}`,
            'relation objects are not database-row columns; use scalar FK fields',
          );
      }
      for (const field of scalarFields) {
        const fieldPath = `${rowPath}.${field.name}`;
        if (!Object.hasOwn(row, field.name)) {
          add(
            fieldPath,
            'missing scalar column; full examples must include defaults and nullable columns explicitly',
          );
          invalid.add(field.name);
          continue;
        }
        scalarValueCount += 1;
        const error = validateValue(field, row[field.name], schema);
        if (error) {
          add(fieldPath, error);
          invalid.add(field.name);
        }
      }
      checkedRows.push({ row, path: rowPath, invalid });
    });
    validRows.set(model.name, checkedRows);
  }
  function tuple(model, fields, entry) {
    if (
      fields.some((name) => entry.invalid.has(name) || entry.row[name] === null)
    )
      return null;
    return JSON.stringify(
      fields.map((name) => canonical(model.fields.get(name), entry.row[name])),
    );
  }
  for (const model of schema.models.values()) {
    const entries = validRows.get(model.name);
    for (const key of model.keys) {
      uniqueConstraints += 1;
      const lookup = new Map();
      for (const entry of entries) {
        const value = tuple(model, key.fields, entry);
        if (value === null) continue; // PostgreSQL default: NULLs are distinct.
        uniqueTupleChecks += 1;
        if (lookup.has(value)) {
          add(
            entry.path,
            `duplicate ${key.primary ? 'primary' : 'unique'} key (${key.fields.join(', ')}); first row at ${lookup.get(value)}`,
          );
        } else lookup.set(value, entry.path);
      }
      indexes.set(`${model.name}:${key.fields.join(',')}`, lookup);
    }
  }
  for (const model of schema.models.values()) {
    for (const relation of model.relations) {
      const targetIndex = indexes.get(
        `${relation.target}:${relation.to.join(',')}`,
      );
      for (const entry of validRows.get(model.name)) {
        if (relation.from.some((name) => entry.invalid.has(name))) continue;
        if (relation.from.some((name) => entry.row[name] === null)) {
          nullableForeignKeysSkipped += 1; // PostgreSQL MATCH SIMPLE semantics.
          continue;
        }
        const value = tuple(model, relation.from, entry);
        foreignKeyChecks += 1;
        if (!targetIndex.has(value)) {
          add(
            entry.path,
            `FK (${relation.from.join(', ')}) has no matching ${relation.target}(${relation.to.join(', ')}) row`,
          );
        }
      }
    }
  }
  return {
    ok: violations.length === 0,
    schemaSha256: schema.sha256,
    coverage: {
      models: schema.models.size,
      populatedModels,
      rows: rowCount,
      scalarValues: scalarValueCount,
      enums: schema.enums.size,
      uniqueConstraints,
      uniqueTupleChecks,
      foreignKeyDefinitions: [...schema.models.values()].reduce(
        (sum, model) => sum + model.relations.length,
        0,
      ),
      foreignKeyChecks,
      nullableForeignKeysSkipped,
    },
    violations,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const schemaOption = args.indexOf('--schema');
  let schemaPath = fileURLToPath(new URL('./schema.prisma', import.meta.url));
  if (schemaOption >= 0) {
    if (!args[schemaOption + 1]) fail('--schema requires a path.');
    schemaPath = path.resolve(args[schemaOption + 1]);
    args.splice(schemaOption, 2);
  }
  const json = args.includes('--json');
  const positional = args.filter((argument) => argument !== '--json');
  if (
    positional.length > 1 ||
    positional.some((argument) => argument.startsWith('--'))
  ) {
    fail(
      'Usage: node prisma/validate-sample-data.mjs [fixture.json] [--schema schema.prisma] [--json]',
    );
  }
  const fixturePath = positional[0]
    ? path.resolve(positional[0])
    : fileURLToPath(
        new URL(
          '../../docs/examples/full-system-sample-data.json',
          import.meta.url,
        ),
      );
  const [rawSchema, fixtureText] = await Promise.all([
    readFile(schemaPath),
    readFile(fixturePath, 'utf8'),
  ]);
  const schema = parseSchema(rawSchema);
  let payload;
  try {
    payload = JSON.parse(fixtureText);
  } catch {
    fail('Fixture is not valid JSON; no content is printed.');
  }
  const result = validateFixture(payload, schema);
  if (result.ok) {
    const { validateBusinessData } =
      await import('./validate-sample-data-business.mjs');
    const business = validateBusinessData(payload);
    result.business = {
      checks: business.checks,
      violationCount: business.errors.length,
    };
    result.violations.push(
      ...business.errors.map((rule) => ({ path: 'business', rule })),
    );
    result.ok = result.violations.length === 0;
  } else
    result.business = {
      checks: 0,
      skipped: 'Structural validation must pass first.',
    };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    const coverage = result.coverage;
    console.log(
      coverage
        ? `${result.ok ? 'PASS' : 'FAIL'}: ${coverage.populatedModels}/${coverage.models} models, ${coverage.rows} rows, ${coverage.foreignKeyChecks} FK tuples, ${coverage.uniqueTupleChecks} PK/UQ tuples, ${result.business.checks} business checks.`
        : 'FAIL: invalid fixture tables object.',
    );
    for (const violation of result.violations)
      console.error(`${violation.path}: ${violation.rule}`);
    console.log(
      'Read-only: no database connection, inserts, migrations, or secret values printed.',
    );
    console.log(
      'Scope: declared schema structure/references and selected business checks; this does not execute PostgreSQL constraints or triggers.',
    );
  }
  if (!result.ok) process.exitCode = 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(`Sample validation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
