import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { buildRenderedResourceIndex, listAssetTypes, type AssetGroup, type AssetType } from "@/services/resources/assetCatalog";
import { applyResourceOp, buildDuplicateResourceValues, getResourceRecord, queryResource } from "@/services/resources/resourceRuntime";
import { getResource } from "@/services/resources/resourceRegistry";
import type { ResourceRecord } from "@/services/resources/resourceTypes";
import { deriveLaunchTasks, summarizeLaunchTasks, type LaunchTask } from "@/services/playground/launchReadiness";
import { loadLaunchReadinessInput } from "@/services/playground/playgroundService";
import type { PageRegistry } from "@/types/pageRegistry";

export interface PlaygroundResourceUsage {
  id: string;
  ref: string;
  file: string;
  pageName: string;
  pagePath?: string;
  sectionName: string;
  role: string;
}

export interface PlaygroundResource {
  ref: string;
  type: AssetType;
  record: ResourceRecord;
  usages: PlaygroundResourceUsage[];
}

export interface PlaygroundAppearance {
  ref: string;
  name?: string;
  usage?: PlaygroundResourceUsage;
}

interface PlaygroundApiOptions {
  businessId?: string | null;
  projectId?: string | null;
  siteId?: string | null;
  industry?: string | null;
  systemType?: string | null;
  vfsFiles?: Record<string, string>;
  notificationEmail?: string | null;
  customDomain?: string | null;
  publishBlockers?: number;
  pageRegistry?: PageRegistry;
}

export interface PlaygroundApi {
  listResources(options?: { group?: AssetGroup; resourceKey?: string }): Promise<PlaygroundResource[]>;
  inspect(ref: string): Promise<PlaygroundResource | null>;
  getUsages(ref: string): Promise<PlaygroundResourceUsage[]>;
  focusAppearance(usageId: string): Promise<void>;
  updateResource(ref: string, values: Record<string, unknown>): Promise<ResourceRecord | null>;
  replaceAsset(ref: string, url: string): Promise<ResourceRecord | null>;
  duplicateResource(ref: string): Promise<ResourceRecord | null>;
  deleteResource(ref: string): Promise<void>;
  getLaunchReadiness(): Promise<{ ready: number; total: number; percent: number }>;
  getLaunchTasks(): Promise<LaunchTask[]>;
}

const PlaygroundApiContext = createContext<PlaygroundApi | null>(null);

function splitRef(ref: string): { resourceKey: string; recordId: string } {
  const separator = ref.indexOf("#");
  if (separator < 1 || separator === ref.length - 1) throw new Error(`Invalid resource reference "${ref}".`);
  return { resourceKey: ref.slice(0, separator), recordId: ref.slice(separator + 1).split(".")[0] };
}

function pageName(file: string): string {
  const leaf = file.split("/").pop()?.replace(/\.(t|j)sx?$/, "").replace(/Page$/, "") || "Page";
  return leaf === "App" || leaf === "Index" ? "Home" : leaf.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function PlaygroundApiProvider({ children, ...options }: PlaygroundApiOptions & { children: ReactNode }) {
  const vfsFiles = options.vfsFiles ?? {};
  const types = useMemo(() => listAssetTypes({ industry: options.industry, vfsFiles }), [options.industry, vfsFiles]);
  const typeByKey = useMemo(() => new Map(types.map((type) => [type.key, type])), [types]);
  const usageIndex = useMemo(() => buildRenderedResourceIndex(vfsFiles), [vfsFiles]);
  const pageByFile = useMemo(() => {
    const entries = Object.values(options.pageRegistry?.pages ?? {}).flatMap((page) => page.filePath ? [[page.filePath.replace(/\\/g, "/").replace(/^\//, ""), page] as const] : []);
    return new Map(entries);
  }, [options.pageRegistry]);
  const context = useMemo(() => options.businessId ? { businessId: options.businessId, projectId: options.projectId, siteId: options.siteId, mode: "builder" as const } : null, [options.businessId, options.projectId, options.siteId]);

  const getUsages = useCallback(async (ref: string): Promise<PlaygroundResourceUsage[]> => {
    return (usageIndex.get(ref) ?? []).map((file, index) => {
      const normalizedFile = file.replace(/\\/g, "/").replace(/^\//, "");
      const page = pageByFile.get(normalizedFile) ?? Object.values(options.pageRegistry?.pages ?? {}).find((candidate) => candidate.title.toLowerCase() === pageName(file).toLowerCase());
      return {
      id: `${encodeURIComponent(ref)}::${encodeURIComponent(file)}`,
      ref,
      file,
      pageName: page?.title ?? pageName(file),
      pagePath: page?.path,
      sectionName: index === 0 ? "Primary placement" : "Connected section",
      role: index === 0 ? "Featured content" : "Resource instance",
      };
    });
  }, [options.pageRegistry, pageByFile, usageIndex]);

  const listResources = useCallback(async (filter?: { group?: AssetGroup; resourceKey?: string }): Promise<PlaygroundResource[]> => {
    if (!context) return [];
    const selectedTypes = types.filter((type) => (!filter?.group || type.group === filter.group) && (!filter?.resourceKey || type.key === filter.resourceKey));
    const rows = await Promise.all(selectedTypes.map(async (type) => {
      const records = await queryResource(type.key, context).catch(() => []);
      return Promise.all(records.map(async (record) => {
        const ref = `${type.key}#${record.id}`;
        return { ref, type, record, usages: await getUsages(ref) } satisfies PlaygroundResource;
      }));
    }));
    return rows.flat();
  }, [context, getUsages, types]);

  const inspect = useCallback(async (ref: string): Promise<PlaygroundResource | null> => {
    if (!context) return null;
    const { resourceKey, recordId } = splitRef(ref);
    const type = typeByKey.get(resourceKey);
    if (!type) return null;
    const record = await getResourceRecord(resourceKey, context, recordId);
    return record ? { ref: `${resourceKey}#${recordId}`, type, record, usages: await getUsages(`${resourceKey}#${recordId}`) } : null;
  }, [context, getUsages, typeByKey]);

  const focusAppearance = useCallback(async (usageId: string) => {
    const [encodedRef] = usageId.split("::");
    const ref = decodeURIComponent(encodedRef);
    for (const frame of document.querySelectorAll("iframe")) frame.contentWindow?.postMessage({ type: "REVEAL_RESOURCE", mark: ref }, "*");
    window.dispatchEvent(new CustomEvent("unison:playground-focus", { detail: { ref, usageId } }));
  }, []);

  const updateResource = useCallback(async (ref: string, values: Record<string, unknown>) => {
    if (!context) throw new Error("Save the site before editing resources.");
    const { resourceKey, recordId } = splitRef(ref);
    const def = getResource(resourceKey);
    if (!def) throw new Error(`Unknown resource "${resourceKey}".`);
    return applyResourceOp({ op: "update", ref: { resourceKey, recordId, kind: def.kind }, values }, context);
  }, [context]);

  const replaceAsset = useCallback(async (ref: string, url: string) => {
    const { resourceKey } = splitRef(ref);
    const def = getResource(resourceKey);
    const imageField = def?.schema.find((field) => field.editable && field.type === "image");
    if (!imageField) throw new Error(`${def?.label ?? resourceKey} has no editable image field.`);
    return updateResource(ref, { [imageField.key]: url });
  }, [updateResource]);

  const duplicateResource = useCallback(async (ref: string) => {
    if (!context) throw new Error("Save the site before duplicating resources.");
    const { resourceKey, recordId } = splitRef(ref);
    const def = getResource(resourceKey);
    if (!def || def.cardinality !== "collection") throw new Error("This resource can't be duplicated.");
    const record = await getResourceRecord(resourceKey, context, recordId);
    if (!record) throw new Error("This saved resource could not be found.");
    return applyResourceOp({ op: "create", resourceKey, values: buildDuplicateResourceValues(def, record) }, context);
  }, [context]);

  const deleteResource = useCallback(async (ref: string) => {
    if (!context) throw new Error("Save the site before deleting resources.");
    const { resourceKey, recordId } = splitRef(ref);
    const def = getResource(resourceKey);
    if (!def) throw new Error(`Unknown resource "${resourceKey}".`);
    await applyResourceOp({ op: "delete", ref: { resourceKey, recordId, kind: def.kind } }, context);
  }, [context]);

  const getLaunchTasks = useCallback(async () => {
    if (!options.businessId) return [];
    const input = await loadLaunchReadinessInput({ businessId: options.businessId, projectId: options.projectId, siteId: options.siteId, industry: options.industry, vfsFiles });
    return deriveLaunchTasks({ ...input, systemType: options.systemType, notificationEmail: options.notificationEmail, customDomain: options.customDomain, publishBlockers: options.publishBlockers });
  }, [options.businessId, options.customDomain, options.industry, options.notificationEmail, options.projectId, options.publishBlockers, options.siteId, options.systemType, vfsFiles]);

  const getLaunchReadiness = useCallback(async () => summarizeLaunchTasks(await getLaunchTasks()), [getLaunchTasks]);

  const api = useMemo<PlaygroundApi>(() => ({ listResources, inspect, getUsages, focusAppearance, updateResource, replaceAsset, duplicateResource, deleteResource, getLaunchReadiness, getLaunchTasks }), [deleteResource, duplicateResource, focusAppearance, getLaunchReadiness, getLaunchTasks, getUsages, inspect, listResources, replaceAsset, updateResource]);
  return <PlaygroundApiContext.Provider value={api}>{children}</PlaygroundApiContext.Provider>;
}

// Provider and consumer intentionally share this module so the public API is one import.
// eslint-disable-next-line react-refresh/only-export-components
export function usePlaygroundApi(): PlaygroundApi {
  const api = useContext(PlaygroundApiContext);
  if (!api) throw new Error("usePlaygroundApi must be used inside PlaygroundApiProvider.");
  return api;
}
