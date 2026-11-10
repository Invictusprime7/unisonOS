import { it } from 'vitest';
import { deriveChatLaunchPlan } from '@/services/launch/chatLaunchPlan';
const cases = {
music: `Help me create a website for my music with releases, tour dates and fan sign-ups.`,
musicConfirmed: `Confirmed site direction:\nHere is the plan for your site:\n\n- **Site identity**: 3manbeatz (producer / music artist)\n- **Releases**: A showcase for your latest tracks\n- **Tour dates**: An upcoming shows schedule with ticket links\n- **Fan sign-up**: An email capture form\n- **Look & feel**: Bold, modern\n\nConversation details:\nHelp me create a website for my music with releases, tour dates and fan sign-ups.\n3manbeatz`,
wedding: `A wedding website with our story, schedule and an RSVP page.`,
festival: `A festival site with lineup, schedule, venue maps and ticketing.`,
};
it('probe', () => { for (const [k,v] of Object.entries(cases)) { const p:any = deriveChatLaunchPlan(v,{promptFirst:true}); console.log(k, JSON.stringify((p.creationInput?.pages||[]).map((x:any)=>x.route))); } });
