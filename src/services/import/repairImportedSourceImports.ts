import { unisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { commitMutation } from '@/services/vfsCommitService';
import { legacyFilesToPatchPlan } from '@/types/patchPlan';
import { evaluateImportedSourceCandidate, findUnresolvedImports } from './importedSourceAcceptance';
import {
  IMPORTED_SOURCE_ACCEPTANCE_PROFILE,
  isImportRecordPath,
  readImportedSourceRecords,
  toVfsPath,
} from './importedSourceRecords';
import type { ImportCompatibilityProfile } from './importCompatibilityProfile';

export interface ImportedSourceRepairInput {
  userId: string;
  businessId: string;
  projectId: string;
  draftId: string;
  revisionId: string;
  projectName: string;
  profile: ImportCompatibilityProfile;
  files: Record<string, string>;
}

export interface ImportedSourceRepairResult {
  files: Record<string, string>;
  revisionId: string;
  repairedFiles: string[];
  resolvedImports: number;
  unresolvedImports: number;
  error?: string;
}

function unresolvedFor(files: Record<string, string>, input: ImportedSourceRepairInput) {
  const records = readImportedSourceRecords(files);
  if (!records) return [];
  const binaryPaths = new Set(records.manifest.files
    .filter((file) => file.storage === 'binary')
    .map((file) => toVfsPath(file.path)));
  return findUnresolvedImports({
    files,
    binaryPaths,
    checkPaths: Object.keys(files).filter((path) => !isImportRecordPath(path)),
    aliases: input.profile.aliases,
  });
}

export async function repairImportedSourceImports(
  input: ImportedSourceRepairInput,
): Promise<ImportedSourceRepairResult> {
  const originalFiles = { ...input.files };
  let candidateFiles = { ...input.files };
  const initialUnresolved = unresolvedFor(candidateFiles, input);
  const attempts = new Map<string, number>();
  let error: string | undefined;

  while (true) {
    const unresolved = unresolvedFor(candidateFiles, input);
    const target = unresolved.map((item) => item.file).find((path) => (attempts.get(path) ?? 0) < 2);
    if (!target) break;
    const attemptNumber = (attempts.get(target) ?? 0) + 1;
    attempts.set(target, attemptNumber);

    try {
      const targetImports = unresolved.filter((item) => item.file === target);
      const edit = await unisonAppBuilder.edit({
        operationId: `import-repair:${input.draftId}:${attemptNumber}:${target}`,
        importedSource: true,
        baseRevisionId: input.revisionId,
        currentFiles: candidateFiles,
        instruction: `Resolve every listed unresolved local import in ${target}. Preserve all source outside this file, keep the current framework, and do not replace a missing module with a stub. If the correct target is not present in the imported files, leave the unresolved import unchanged.`,
        page: {
          title: input.projectName,
          route: '/',
          filePath: target,
          role: `${input.profile.framework} imported source`,
        },
        sourceTargets: [target],
        diagnostics: targetImports.map(({ specifier }) => `Unresolved local import ${JSON.stringify(specifier)} in ${target}.`),
        timeoutMs: 120_000,
      });

      if (edit.candidate.status !== 'ready-for-commit' || !edit.changeSet) continue;
      const proposed = edit.candidateFiles as Record<string, string>;
      const changedPaths = Object.keys(proposed).filter((path) => candidateFiles[path] !== proposed[path]);
      if (changedPaths.length === 0 || changedPaths.some((path) => path !== target)) continue;

      const evaluation = await evaluateImportedSourceCandidate({ before: candidateFiles, after: proposed });
      if (!evaluation.ok || evaluation.rejection) continue;
      const targetRemaining = unresolvedFor(proposed, input).filter((item) => item.file === target).length;
      if (targetRemaining >= targetImports.length) continue;

      candidateFiles = proposed;
    } catch (repairError) {
      error = repairError instanceof Error ? repairError.message : String(repairError);
      break;
    }
  }

  const changedPaths = Object.keys(candidateFiles)
    .filter((path) => originalFiles[path] !== candidateFiles[path])
    .sort();
  const remaining = unresolvedFor(candidateFiles, input).length;
  if (changedPaths.length === 0) {
    return {
      files: originalFiles,
      revisionId: input.revisionId,
      repairedFiles: [],
      resolvedImports: 0,
      unresolvedImports: remaining,
      error,
    };
  }

  try {
    const changedFiles = Object.fromEntries(changedPaths.map((path) => [path, candidateFiles[path]]));
    const commit = await commitMutation({
      source: 'ai-builder',
      identity: {
        userId: input.userId,
        businessId: input.businessId,
        projectId: input.projectId,
        draftId: input.draftId,
        revisionId: input.revisionId,
        sessionId: `external-import:${input.draftId}`,
      },
      current: { vfsFiles: originalFiles },
      patch: legacyFilesToPatchPlan(changedFiles, `Affinity resolved imported source imports for ${input.projectName}`),
      options: { acceptanceProfile: IMPORTED_SOURCE_ACCEPTANCE_PROFILE, businessName: input.projectName },
    });
    if (commit.status !== 'committed' || !commit.persistedRevisionId) {
      throw new Error('Affinity repairs were not saved as a new project version.');
    }
    return {
      files: commit.vfsFiles,
      revisionId: commit.persistedRevisionId,
      repairedFiles: changedPaths,
      resolvedImports: Math.max(0, initialUnresolved.length - remaining),
      unresolvedImports: remaining,
      error,
    };
  } catch (commitError) {
    return {
      files: originalFiles,
      revisionId: input.revisionId,
      repairedFiles: [],
      resolvedImports: 0,
      unresolvedImports: initialUnresolved.length,
      error: commitError instanceof Error ? commitError.message : String(commitError),
    };
  }
}