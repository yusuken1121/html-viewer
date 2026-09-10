import { afterEach, describe, expect, it, vi } from "vitest"
import type { ILogger } from "@/core/ports/logger.port"
import { logger, setLogger, consoleLogger } from "./logger"

afterEach(() => setLogger(consoleLogger))

describe("logger", () => {
  it("forwards every call to the installed implementation", () => {
    const spy: ILogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    setLogger(spy)

    logger.info("started", { port: 3000 })
    logger.error("failed", new Error("boom"), { route: "/api/chat" })

    expect(spy.info).toHaveBeenCalledWith("started", { port: 3000 })
    expect(spy.error).toHaveBeenCalledWith("failed", expect.any(Error), {
      route: "/api/chat",
    })
  })

  it("keeps routing to the newest implementation after a swap", () => {
    const first: ILogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    const second: ILogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }

    setLogger(first)
    setLogger(second)
    logger.warn("late")

    expect(first.warn).not.toHaveBeenCalled()
    expect(second.warn).toHaveBeenCalledWith("late", undefined)
  })
})
