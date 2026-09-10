import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ChatComposer } from "./chat-composer"

function setup(isPending = false) {
  const onSubmit = vi.fn()
  render(<ChatComposer onSubmit={onSubmit} isPending={isPending} />)
  const textarea = screen.getByPlaceholderText("Type your message...")
  return { onSubmit, textarea }
}

describe("ChatComposer", () => {
  it("submits on Enter and clears the field", () => {
    const { onSubmit, textarea } = setup()

    fireEvent.change(textarea, { target: { value: "hello" } })
    fireEvent.keyDown(textarea, { key: "Enter" })

    expect(onSubmit).toHaveBeenCalledWith("hello")
    expect(textarea).toHaveValue("")
  })

  it("inserts a newline on Shift+Enter instead of submitting", () => {
    const { onSubmit, textarea } = setup()

    fireEvent.change(textarea, { target: { value: "line one" } })
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(textarea).toHaveValue("line one")
  })

  it("ignores whitespace-only input", () => {
    const { onSubmit, textarea } = setup()

    fireEvent.change(textarea, { target: { value: "   " } })
    fireEvent.keyDown(textarea, { key: "Enter" })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("does not submit while a request is in flight", () => {
    const { onSubmit, textarea } = setup(true)

    fireEvent.change(textarea, { target: { value: "hello" } })
    fireEvent.keyDown(textarea, { key: "Enter" })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(textarea).toBeDisabled()
  })

  it("submits when the send button is clicked", () => {
    const { onSubmit, textarea } = setup()

    fireEvent.change(textarea, { target: { value: "via button" } })
    fireEvent.click(screen.getByRole("button", { name: "Send message" }))

    expect(onSubmit).toHaveBeenCalledWith("via button")
  })
})
