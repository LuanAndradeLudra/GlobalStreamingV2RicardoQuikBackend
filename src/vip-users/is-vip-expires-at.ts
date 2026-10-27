import { BadRequestException } from '@nestjs/common';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export const VIP_EXPIRES_AT_MESSAGE =
  'expiresAt deve ser uma data ISO 8601 completa, por exemplo 2026-11-18T23:59:59.000Z';

export function isCompleteIsoDate(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string' || value.trim() === '') return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function parseExpiresAt(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(VIP_EXPIRES_AT_MESSAGE);
  }
  return date;
}

export function IsVipExpiresAt(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isVipExpiresAt',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isCompleteIsoDate(value);
        },
        defaultMessage(args: ValidationArguments) {
          return args.property === 'expiresAt' ? VIP_EXPIRES_AT_MESSAGE : `${args.property} deve ser uma data ISO 8601 completa`;
        },
      },
    });
  };
}
