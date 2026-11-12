/**
 * Optional design references. Importing this module registers every built-in
 * source; future knowledge expansions add a source file and one line below.
 */
import { registerDesignReferenceSource } from './registry';
import { unisonLoveableReferenceSource } from './unisonLoveableSource';

registerDesignReferenceSource(unisonLoveableReferenceSource);

export * from './registry';
export { UNISON_LOVEABLE_REFERENCE_ID, UNISON_LOVEABLE_LIBRARY, pageRoleFor } from './unisonLoveableSource';
