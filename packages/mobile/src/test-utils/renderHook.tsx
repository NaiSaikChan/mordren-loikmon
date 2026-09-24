/**
 * Minimal `renderHook` for hook tests (the project has no @testing-library).
 * Test files using it need the `@jest-environment jsdom` docblock, and should
 * import it first (it polyfills what jsdom lacks for axios).
 */
import React, { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const g = globalThis as Record<string, unknown>
g.IS_REACT_ACT_ENVIRONMENT = true
const nodeUtil = jest.requireActual<{ TextEncoder: typeof TextEncoder; TextDecoder: typeof TextDecoder }>('util')
g.TextEncoder ??= nodeUtil.TextEncoder
g.TextDecoder ??= nodeUtil.TextDecoder

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
}

export interface RenderHookResult<R, P> {
  result: { readonly current: R }
  rerender: (props: P) => Promise<void>
  unmount: () => void
  client: QueryClient
}

export async function renderHook<R, P = undefined>(
  hook: (props: P) => R,
  options: { initialProps?: P; client?: QueryClient; wrapper?: (props: { children: ReactNode }) => React.ReactElement } = {},
): Promise<RenderHookResult<R, P>> {
  const client = options.client ?? createTestQueryClient()
  const result = { current: undefined as R }
  function Probe({ props }: { props: P }) {
    result.current = hook(props)
    return null
  }
  const Wrapper = options.wrapper ?? (({ children }: { children: ReactNode }) => <>{children}</>)
  const root: Root = createRoot(document.createElement('div'))
  const render = (props: P) => (
    <QueryClientProvider client={client}>
      <Wrapper>
        <Probe props={props} />
      </Wrapper>
    </QueryClientProvider>
  )
  await act(async () => {
    root.render(render(options.initialProps as P))
  })
  return {
    result,
    client,
    rerender: async (props: P) => {
      await act(async () => {
        root.render(render(props))
      })
    },
    unmount: () => act(() => root.unmount()),
  }
}

/** Flush pending promises/timers inside act (React Query resolves asynchronously). */
export async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

/** Polls `check` (inside act) until it stops throwing. */
export async function waitFor(check: () => void, timeout = 1000): Promise<void> {
  const start = Date.now()
  for (;;) {
    try {
      check()
      return
    } catch (err) {
      if (Date.now() - start > timeout) throw err
      await flush(5)
    }
  }
}
