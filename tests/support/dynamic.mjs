import React, { lazy, Suspense } from "react";
// Next's chunk loader is build-specific; this test adapter preserves lazy component lifecycles.
export default function dynamic(loader) {
  const Component = lazy(() => loader().then(value => ({ default: value.default ?? value })));
  return function TestLazyComponent(props) {
    return React.createElement(Suspense, { fallback: null }, React.createElement(Component, props));
  };
}
