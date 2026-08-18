import { z } from 'zod';
import { ChatbotPostbackHandler } from 'src/types/chatbotState';

import {
  createAdvancedDescriptionPrompt,
  createAskForMediaSourceReply,
} from './reportFlow';

const inputSchema = z.object({
  choice: z.enum(['yes', 'no']),
  issueId: z.string(),
  inputType: z.enum(['image', 'video']),
});

/** Postback input type for ASKING_MEDIA_SOURCE state handler. */
export type MediaSourceInput = z.infer<typeof inputSchema>;

const askingMediaSource: ChatbotPostbackHandler = async ({
  context,
  postbackData: { input },
}) => {
  const { choice, issueId, inputType } = inputSchema.parse(input);

  if (choice === 'yes') {
    return {
      context: {
        ...context,
        awaitingMediaSource: { issueId, inputType },
      },
      replies: createAskForMediaSourceReply(inputType),
    };
  }

  return {
    context,
    replies: [
      createAdvancedDescriptionPrompt(
        issueId,
        context.sessionId,
        inputType === 'image' ? '圖片內容' : '影片內容'
      ),
    ],
  };
};

export default askingMediaSource;
