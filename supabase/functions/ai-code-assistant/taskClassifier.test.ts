import {
  builderEditClassificationDirective,
  classifyBuilderEditTask,
  classifyTask,
} from "../_shared/taskClassifier.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test("keeps the legacy wizard-seed route isolated from research and memory", () => {
  const task = classifyTask({
    mode: "wizard-seed",
    editMode: false,
    navPageGen: false,
    surgicalEdit: false,
    behavioralEdit: false,
    debugMode: false,
  });

  assertEquals(task.type, "wizard_seed_generation");
  assertEquals(task.fastPath, true);
  assertEquals(task.shouldUseMemory, false);
  assertEquals(task.shouldUseCompactContext, true);
  assertEquals(task.skipResearch, true);
  assertEquals(task.skipThinking, true);
});

Deno.test("classifies Wizard content enrichment as compiler-owned JSON data", () => {
  const task = classifyTask({
    mode: "wizard-content",
    editMode: false,
    navPageGen: false,
    surgicalEdit: false,
    behavioralEdit: false,
    debugMode: false,
  });

  assertEquals(task.type, "wizard_content_enrichment");
  assertEquals(task.fastPath, true);
  assertEquals(task.prefersJsonOutput, true);
  assertEquals(task.skipResearch, true);
  assertEquals(task.skipThinking, true);
});

Deno.test("routes theme edits to isolated structured output", () => {
  const task = classifyTask({ mode: "theme-edit", editMode: true, navPageGen: false, surgicalEdit: false, behavioralEdit: false, debugMode: false });
  assertEquals(task.type, "theme_edit");
  assertEquals(task.prefersJsonOutput, true);
  assertEquals(task.shouldUseMemory, false);
  assertEquals(task.skipResearch, true);
  assertEquals(task.skipThinking, true);
});

Deno.test("routes homepage planning chat to the isolated site discovery lane", () => {
  const task = classifyTask({
    mode: "site-discovery",
    editMode: false,
    navPageGen: false,
    surgicalEdit: false,
    behavioralEdit: false,
    debugMode: false,
  });

  assertEquals(task.type, "site_discovery");
  assertEquals(task.fastPath, true);
  assertEquals(task.shouldUseMemory, false);
  assertEquals(task.prefersJsonOutput, false);
  assertEquals(task.skipResearch, true);
  assertEquals(task.skipThinking, true);
});

Deno.test("keeps surgical and behavioral intent ahead of the template-react transport", () => {
  const surgical = classifyTask({ mode: "template-react", editMode: true, navPageGen: false, surgicalEdit: true, behavioralEdit: false, debugMode: false });
  const behavioral = classifyTask({ mode: "template-react", editMode: true, navPageGen: false, surgicalEdit: false, behavioralEdit: true, debugMode: false });
  assertEquals(surgical.type, "surgical_edit");
  assertEquals(behavioral.type, "behavioral_edit");
});

Deno.test("classifies copy relocation with distinct source and destination semantics", () => {
  const classification = classifyBuilderEditTask({
    editorOperations: ["copy.move"],
    scope: { relation: "source_destination" },
    complexity: "compound",
  });

  assertEquals(classification, "content_relocation");
  if (!classification) throw new Error("Expected an edit classification");
  if (!builderEditClassificationDirective(classification).includes("Move the content exactly once")) {
    throw new Error("Relocation guidance must prevent duplicate content");
  }
});

Deno.test("classifies page creation plus footer routes as one multi-target operation", () => {
  const classification = classifyBuilderEditTask({
    editorOperations: ["page.create", "navigation.update", "route.bind"],
    scope: { relation: "multi_target" },
    complexity: "compound",
  });

  assertEquals(classification, "page_and_route");
  if (!classification) throw new Error("Expected an edit classification");
  if (!builderEditClassificationDirective(classification).includes("canonical route operations")) {
    throw new Error("Page routing guidance must preserve topology ownership");
  }
});
