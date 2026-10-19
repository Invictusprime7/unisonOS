import { CANDIDATE_GENERATED_NOTICE, neutralizeModelSuccessClaim } from '@/services/builder/builderTransactionState';

/** Public response prose only; native thinking must never become chat content. */
export function affinityReply(content: string | undefined): string {
  return neutralizeModelSuccessClaim(
    content?.replace(/<(thinking|think|analysis)>[\s\S]*?<\/\1>/gi, ''),
  ) || CANDIDATE_GENERATED_NOTICE;
}

export function affinityReplyParagraphs(content: string): string[] {
  return content.trim().split(/\n\s*\n/).filter(Boolean);
}