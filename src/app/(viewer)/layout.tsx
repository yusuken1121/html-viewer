/**
 * Reader shell — no sidebar, no header, no padding.
 *
 * The document takes the whole viewport; `DocumentViewer` draws its own thin
 * toolbar. Kept as a separate route group so the `(app)` chrome never wraps it.
 */
export default function ViewerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>
}
