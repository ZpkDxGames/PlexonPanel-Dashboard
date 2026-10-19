"use client";
import dynamic from "next/dynamic";
const Application = dynamic(() => import("../src/ui/Application"), {
  ssr: false,
});
export default Application;
