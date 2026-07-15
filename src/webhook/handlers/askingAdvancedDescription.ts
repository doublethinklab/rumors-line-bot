import { z } from 'zod';
import { ChatbotPostbackHandler } from 'src/types/chatbotState';

import {
  createDescriptionDeclinedReply,
  createAskForDescriptionTextReply,
} from './reportFlow';

const inputSchema = z.object({
  choice: z.enum(['yes', 'no']),
  issueId: z.string(),
});

/** Postback input type for ASKING_ADVANCED_DESCRIPTION state handler */
export type AdvancedDescriptionInput = z.infer<typeof inputSchema>;

/**
 * Handles the yes/no postback asking the reporter whether they want to add an
 * advanced description to the issue they just reported (Scenario 3/4/5/6).
 */
const askingAdvancedDescription: ChatbotPostbackHandler = async ({
  context,
  postbackData: { input },
}) => {
  const { choice, issueId } = inputSchema.parse(input);

  if (choice === 'no') {
    return { context, replies: createDescriptionDeclinedReply() };
  }

  return {
    context: { ...context, awaitingDescriptionForIssueId: issueId },
    replies: createAskForDescriptionTextReply(),
  };
};

export default askingAdvancedDescription;
