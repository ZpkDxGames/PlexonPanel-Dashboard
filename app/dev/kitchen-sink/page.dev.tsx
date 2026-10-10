"use client";

import dynamic from "next/dynamic";
import "../../_development/kitchen-sink.css";

// Browser-only local fixtures and native UI specimens are not server-rendered.
const KitchenSink = dynamic(() => import("../../_development/kitchen-sink"), { ssr: false });

export default function DevelopmentKitchenSink() {
  return <KitchenSink />;
}
