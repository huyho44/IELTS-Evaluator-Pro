import { BadRequestException } from '@nestjs/common';
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Expected a JSON object');
  return value as Record<string, unknown>;
}
export function text(value: unknown, field: string, max = 10000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new BadRequestException(
      `${field} must be a non-empty string (maximum ${max} characters)`,
    );
  return value.trim();
}
export function uuid(value: unknown, field = 'id'): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new BadRequestException(`${field} must be a UUID`);
  return value;
}
export function integer(
  value: unknown,
  field: string,
  min = 0,
  max = 100000,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new BadRequestException(
      `${field} must be an integer from ${min} to ${max}`,
    );
  return value;
}
export function band(value: unknown, field = 'band'): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 9 ||
    !Number.isInteger(value * 2)
  )
    throw new BadRequestException(
      `${field} must be between 0 and 9 in increments of 0.5`,
    );
  return value;
}
export function date(value: unknown, field: string): Date {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new BadRequestException(`${field} must be an ISO date-time`);
  return new Date(value);
}
