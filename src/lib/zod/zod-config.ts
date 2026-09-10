import { FIELD_LABELS } from "@/constants/labels"
import z from "zod"

z.config({
  customError: (iss) => {
    const pathKey = iss.path?.length ? iss.path.join(".") : undefined
    const label =
      FIELD_LABELS[pathKey as keyof typeof FIELD_LABELS] ?? "対象の項目"

    switch (iss.code) {
      case "too_small":
        if (iss.minimum === 1) {
          return `${label}を入力してください`
        }
        if (iss.origin === "number") {
          return `${label}は${iss.minimum}以上で入力してください`
        }
        if (iss.origin === "array") {
          return `${label}は${iss.minimum}個以上選択してください`
        }
        return `${label}は${iss.minimum}文字以上で入力してください`
      case "too_big":
        if (iss.origin === "number") {
          return `${label}は${iss.maximum}以下で入力してください`
        }
        if (iss.origin === "array") {
          return `${label}は${iss.maximum}個以下で選択してください`
        }
        return `${label}は${iss.maximum}文字以下で入力してください`
      case "invalid_value":
        return `${label}の値が不正です`
      case "invalid_format":
        if (iss.format === "email") {
          return `正しいメールアドレス形式で入力してください`
        }
        if (iss.format === "url") {
          return `正しいURL形式で入力してください`
        }
        return `${label}は無効な値です`
      case "invalid_type":
        if (iss.input === undefined || iss.input === null || iss.input === "") {
          return `${label}を入力してください`
        }
        return `${label}の形式が正しくありません`
      case "custom":
        return iss.message
      default:
        return null
    }
  },
})

export {}
