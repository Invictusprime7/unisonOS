/** Unified Records read model. Original resource/record IDs remain the write address. */
import { listRecordCollections, type RecordCollectionKind } from './resourceRegistry';
import { queryResource } from './resourceRuntime';
import type { ResourceContext, ResourceDefinition, ResourceRecord } from './resourceTypes';

export interface UnifiedRecord {
  key: string;
  kind: RecordCollectionKind;
  resource: ResourceDefinition;
  record: ResourceRecord;
  title: string;
}
export async function loadUnifiedRecords(ctx: ResourceContext): Promise<{ records: UnifiedRecord[]; errors: string[] }> {
  const records: UnifiedRecord[] = [];
  const errors: string[] = [];
  await Promise.all(listRecordCollections().flatMap((collection) => collection.resources.map(async (resource) => {
    try {
      const rows = await queryResource(resource.key, ctx);
      for (const record of rows) records.push({
        key: `${resource.key}#${record.id}`, kind: collection.kind, resource, record,
        title: String(record.author_name ?? record.title ?? record.name ?? record.question ?? record.id),
      });
    } catch (error) { errors.push(`${collection.label}: ${error instanceof Error ? error.message : 'Could not load records'}`); }
  })));
  return { records: records.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title) || a.key.localeCompare(b.key)), errors };
}