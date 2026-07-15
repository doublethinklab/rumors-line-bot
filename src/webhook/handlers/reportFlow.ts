import type { Message } from '@line/bot-sdk';
import type { Platform } from 'src/lib/urlParser';
import { createPostbackAction } from './utils';
import type { AdvancedDescriptionInput } from './askingAdvancedDescription';

export const PLATFORM_DISPLAY_NAME: Record<Platform, string> = {
  facebook: 'Facebook',
  twitter: 'X（Twitter）',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  threads: 'Threads',
  weibo: '微博',
  bilibili: '哔哩哔哩',
  dcard: 'Dcard',
  ptt: 'PTT',
  unknown: '未知',
};

export const CONTINUE_PROMPT = '可以繼續回報新的可疑資訊囉！';

export const WELCOME_MESSAGE = `感謝加入 DTL OHub 小幫鼠🐭！
這邊主要提供給對防範境外可疑資訊的夥伴一同合作，來觀測網路上的各種可疑資訊！也會定期您分享 DTL 的社群推廣內容。

在此請依照以下規範回報可疑資訊：

1. 請一次只傳一則訊息，若有一則以上的訊息（e.g., 連結、圖片、影片）需要回報，請待系統提示後再傳下一則訊息。
2. 請勿將本工具作為個人記事留言板
3. ⭕️ 我們只接收如 1. 文字、2. 連結、3. 圖片、4. 影片 等訊息類型。
4. ❌ 我們不接收以下類型資訊如：1. 貼圖、2. pdf 檔、3. xls 檔、4. ppt 檔、etc…
5. 本機器人所收集之可疑訊息，僅供學術研究與數位輿情分析之用。我們絕不收集、亦不留存您的個人資料（如 LINE 帳號、大頭貼、個資等），所有回報內容將以去識別化方式進行分析，請安心回報。

您可以開始回報觀察到的可疑資訊！`;

export function createTextReceivedReply(): Message[] {
  return [
    {
      type: 'text',
      text: '小幫鼠收到「文字訊息」，感謝回報！\n會由 DTL 團隊進行後續分析。',
    },
    { type: 'text', text: CONTINUE_PROMPT },
  ];
}

export function createLinkReceivedAck(platform: Platform): Message {
  return {
    type: 'text',
    text: `小幫鼠收到「連結」，來自「${PLATFORM_DISPLAY_NAME[platform]}」平台，感謝回報！\n會由 DTL 團隊進行後續分析。`,
  };
}

export function createMediaReceivedAck(inputType: 'image' | 'video'): Message {
  const label = inputType === 'image' ? '圖片' : '影片';
  return {
    type: 'text',
    text: `小幫鼠收到「${label}」，感謝回報！\n會由 DTL 團隊進行後續分析。`,
  };
}

/**
 * Yes/no prompt asking the reporter if they want to add an advanced description.
 * The issue id is embedded in both postback payloads so the follow-up postback
 * handler doesn't need any prior session state to know which issue it refers to.
 */
export function createAdvancedDescriptionPrompt(
  issueId: string,
  sessionId: number
): Message {
  const text =
    '您是否願意針對您提供的訊息做進階描述，以便分析團隊做後續判斷。\n請選擇「是」或「否」。';

  return {
    type: 'template',
    altText: text,
    template: {
      type: 'confirm',
      text,
      actions: [
        createPostbackAction<'ASKING_ADVANCED_DESCRIPTION'>(
          '是',
          { choice: 'yes', issueId } satisfies AdvancedDescriptionInput,
          '是',
          sessionId,
          'ASKING_ADVANCED_DESCRIPTION'
        ),
        createPostbackAction<'ASKING_ADVANCED_DESCRIPTION'>(
          '否',
          { choice: 'no', issueId } satisfies AdvancedDescriptionInput,
          '否',
          sessionId,
          'ASKING_ADVANCED_DESCRIPTION'
        ),
      ],
    },
  };
}

export function createUnsupportedTypeReply(): Message[] {
  return [
    {
      type: 'text',
      text: '很抱歉，小幫鼠不收集您回傳的訊息類型！\n請傳以下類型的訊息，如：文字、連結、圖片、影片。',
    },
    { type: 'text', text: CONTINUE_PROMPT },
  ];
}

export function createDescriptionDeclinedReply(): Message[] {
  return [{ type: 'text', text: `收到，${CONTINUE_PROMPT}` }];
}

export function createAskForDescriptionTextReply(): Message[] {
  return [{ type: 'text', text: '請用「文字」描述您回傳之訊息。' }];
}

export function createDescriptionReceivedReply(): Message[] {
  return [
    {
      type: 'text',
      text: '小幫鼠收到進階描述，感謝回報！\n會由 DTL 團隊進行後續分析。',
    },
    { type: 'text', text: CONTINUE_PROMPT },
  ];
}
