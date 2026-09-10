"use client"

import {
  useForm,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"

/**
 * `useForm` wired to a Zod schema.
 *
 * Saves repeating the resolver and, more importantly, derives the form's value
 * type from the schema — so a field renamed in the schema becomes a type error
 * in the component instead of a silently undefined value.
 *
 * Takes a schema whose input and output types match, which is the case for
 * every plain form. A schema that transforms on parse (`z.coerce`, `.transform`)
 * needs `useForm` directly, with the input and output types spelled out.
 */
export function useZodForm<TValues extends FieldValues>(
  schema: z.ZodType<TValues, TValues>,
  options: Omit<UseFormProps<TValues, unknown, TValues>, "resolver"> & {
    defaultValues: TValues
  },
): UseFormReturn<TValues, unknown, TValues> {
  return useForm<TValues, unknown, TValues>({
    resolver: zodResolver(schema),
    ...options,
  })
}
