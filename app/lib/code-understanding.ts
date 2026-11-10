import type { GraphEdge, GraphNode, NodeDetail } from "../types/workspace";

export type ExplanationLevel = "simple" | "developer";

type Explanation = NonNullable<NodeDetail["explanations"]>[number];

export type InspectorRelationship = GraphEdge & {
  direction: "incoming" | "outgoing";
  peer?: GraphNode;
};

const roleDescriptions: Record<NodeDetail["type"], string> = {
  Page: "A navigable screen that coordinates the UI and data needed for this route.",
  Component: "A reusable piece of interface that turns inputs and state into rendered UI.",
  Hook: "Reusable behavior that manages state, effects, or data for other components.",
  Service: "An application boundary that reads, writes, or transforms external data.",
  Utility: "A shared helper that performs focused work without rendering interface elements.",
};

const kindPurpose: Record<string, string> = {
  declaration: "Defines the file's primary behavior.",
  import: "Brings in behavior or values this file needs.",
  render: "Produces interface elements that users can see.",
  hook: "Uses reusable React behavior.",
  props: "Receives data or callbacks from a parent.",
  state: "Keeps information that can change over time.",
  effect: "Runs work after rendering or when dependencies change.",
  event: "Responds to a user or browser action.",
  api: "Communicates with an external data source.",
  resource: "Loads a style, asset, or local data file.",
  export: "Makes behavior available to other files.",
  diagnostic: "Points to code that may require attention.",
};

const conceptDescriptions: Record<string, string> = {
  props: "Inputs supplied by a parent component.",
  state: "Data owned by this file that can trigger another render when it changes.",
  hook: "React behavior reused through a function beginning with use.",
  effect: "Work synchronized with rendering, browser APIs, or external systems.",
  event: "A path that starts after a user or browser interaction.",
  api: "A boundary where data enters or leaves the application.",
  render: "The interface this file returns or places on screen.",
  resource: "A style, asset, or data file used by this code.",
  import: "A runtime dependency required by this file.",
  export: "Behavior exposed for other files to use.",
};

const titleCase = (value: string) => value.replace(/(^|\s|[-_/])\w/g, (match) => match.toUpperCase()).replace(/[-_]/g, " ");

export function explanationWhy(kind: string) {
  return kindPurpose[kind] ?? "This contributes to the file's runtime behavior.";
}

export function relationshipMeaning(relationship: InspectorRelationship) {
  const kind = relationship.kind ?? "import";
  const peer = relationship.peer?.name ?? (relationship.direction === "outgoing" ? relationship.to : relationship.from);
  const direction = relationship.direction === "outgoing";
  const meanings: Record<string, string> = {
    import: direction ? `${peer} supplies code used by this file.` : `${peer} imports and uses code exported here.`,
    render: direction ? `This file places ${peer} in its rendered interface.` : `${peer} renders this file as part of its interface.`,
    data: direction ? `This file sends data into ${peer}.` : `${peer} provides data used by this file.`,
    callback: direction ? `This file gives ${peer} a callback to invoke.` : `${peer} can trigger behavior declared in this file.`,
    api: direction ? `This file requests or sends data through ${peer}.` : `${peer} receives data or behavior from this service.`,
    route: direction ? `Navigation from this file can reach ${peer}.` : `${peer} exposes or navigates to this route.`,
  };
  return meanings[kind] ?? `${peer} is connected to this file.`;
}

export function buildCodeUnderstanding(
  detail: NodeDetail,
  relationships: InspectorRelationship[],
) {
  const explanations: Explanation[] = detail.explanations ?? detail.steps.map((text) => ({ text, line: 1, endLine: 1, kind: "analysis" }));
  const incoming = relationships.filter((item) => item.direction === "incoming");
  const outgoing = relationships.filter((item) => item.direction === "outgoing");
  const fileName = detail.file.split("/").at(-1) ?? detail.file;
  const isEntry = /^(?:main|index|bootstrap|entry)\.[cm]?[jt]sx?$/i.test(fileName);
  const behaviorKinds = new Set(explanations.map((item) => item.kind));
  const role = isEntry ? "Application entry point" : detail.type;
  const basePurpose = isEntry
    ? "This file starts the application, loads shared setup, and hands control to the root interface."
    : roleDescriptions[detail.type];
  const additions = [
    behaviorKinds.has("api") ? "It also exchanges data with an external service." : "",
    behaviorKinds.has("state") ? "It owns state that can update what users see." : "",
    behaviorKinds.has("event") ? "It responds to user interaction." : "",
  ].filter(Boolean);

  const flowKindCounts = new Map<string, number>();
  const flow = explanations
    .filter((item) => !["diagnostic", "export"].includes(item.kind))
    .sort((left, right) => left.line - right.line)
    .filter((item) => {
      const count = flowKindCounts.get(item.kind) ?? 0;
      const limit = ["event", "render"].includes(item.kind) ? 2 : 1;
      flowKindCounts.set(item.kind, count + 1);
      return count < limit;
    })
    .slice(0, 7)
    .map((item, index) => ({
      ...item,
      order: index + 1,
      label: titleCase(item.kind === "declaration" ? "Define" : item.kind),
      why: explanationWhy(item.kind),
    }));

  const journeyKinds = new Set(["props", "state", "event", "effect", "api", "render"]);
  const dataJourney = explanations
    .filter((item) => journeyKinds.has(item.kind))
    .sort((left, right) => left.line - right.line)
    .slice(0, 8)
    .map((item, index) => ({ ...item, order: index + 1, label: titleCase(item.kind) }));

  const concepts = Array.from(new Set(explanations.map((item) => item.kind)))
    .filter((kind) => conceptDescriptions[kind])
    .map((kind) => ({
      kind,
      label: titleCase(kind),
      description: conceptDescriptions[kind],
      count: explanations.filter((item) => item.kind === kind).length,
    }));

  const impact = {
    summary: incoming.length
      ? `Changing this file may affect ${incoming.length} connected ${incoming.length === 1 ? "file" : "files"}.`
      : "No other analyzed file directly depends on this one.",
    incoming,
    outgoing,
    resources: detail.relations?.resources ?? [],
  };

  const pipeline = {
    input: behaviorKinds.has("props")
      ? "Props and callbacks from a parent"
      : behaviorKinds.has("api")
        ? "Data from an external service"
        : outgoing.length
          ? "Values imported from dependencies"
          : "Browser or application startup",
    processing: behaviorKinds.has("state")
      ? "State and hooks transform the input"
      : behaviorKinds.has("effect")
        ? "Effects synchronize the behavior"
        : "The file applies its declared logic",
    output: behaviorKinds.has("render")
      ? "Rendered interface elements"
      : behaviorKinds.has("export")
        ? "Exported behavior for other files"
        : incoming.length
          ? "Behavior consumed by dependents"
          : "A runtime result",
  };

  return {
    role,
    purpose: [basePurpose, ...additions].join(" "),
    flow,
    dataJourney,
    concepts,
    impact,
    pipeline,
    explanationCount: explanations.length,
    dependencyCount: outgoing.length,
    dependentCount: incoming.length,
  };
}
