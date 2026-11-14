import { lazy, Suspense, type ComponentProps } from "react";

// Molstar is large. Load it only when a structure is shown.
const Viewer = lazy(() =>
  import("./MolstarViewer").then((m) => ({ default: m.MolstarViewer })),
);

type Props = ComponentProps<typeof Viewer>;

export function MolstarViewer(props: Props) {
  return (
    // Same height as the viewer, so the page does not jump.
    <Suspense fallback={<div style={{ height: props.height ?? 480 }} />}>
      <Viewer {...props} />
    </Suspense>
  );
}
