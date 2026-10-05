import {handleAgentHealth} from '../_shared/agent-health-check.ts';
Deno.serve(handleAgentHealth);
