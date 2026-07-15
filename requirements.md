# Line Bot Pipeline

以下共 **八** 種情境

# Scenario 1 \- Beginning 

【當系統偵測到使用者第一次加入】

**Bot：**  
感謝加入 DTL OHub 小幫鼠🐭！  
這邊主要提供給對防範境外可疑資訊的夥伴一同合作，來觀測網路上的各種可疑資訊！也會定期您分享 DTL 的社群推廣內容。

在此請依照以下規範回報可疑資訊：

1. 請一次只傳一則訊息，若有一則以上的訊息（e.g., 連結、圖片、影片）需要回報，請待系統提示後再傳下一則訊息。  
2. 請勿將本工具作為個人記事留言板  
3. ⭕️ 我們只接收如 1\. 文字、2. 連結、3. 圖片、4. 影片 等訊息類型。  
4. ❌ 我們不接收以下類型資訊如：1. 貼圖、2. pdf 檔、3. xls 檔 4\. ppt 檔、 etc…  
5. 本機器人所收集之可疑訊息，僅供學術研究與數位輿情分析之用。我們**絕不收集、亦不留存**您的個人資料（如 LINE 帳號、大頭貼、個資等），所有回報內容將以去識別化方式進行分析，請安心回報。

您可以開始回報觀察到的可疑資訊！

# Scenario 2 \- report pure text

【當系統收到使用者回傳之文字訊息】

**User：**  
\[text text text\]

**Bot：**  
小幫鼠收到「文字訊息」，感謝回報！  
會由 DTL 團隊進行後續分析。

**Bot：**  
可以繼續回報新的可疑資訊囉！

# 

# Scenario 3 \- report text with link

【當系統收到使用者回傳包含連結之文字訊息】

**User：**  
\[text \+ url\]

**Bot：**  
小幫鼠收到「連結」，來自「xxx」平台，感謝回報！  
會由 DTL 團隊進行後續分析。

**Bot：**  
您是否願意針對您提供的訊息做進階描述，以便分析團隊做後續判斷。  
請選擇「是」或「否」。

**Bot：**  
【是 or 否 選項】

示意圖：  
![][image1]

【if user 選擇「是」】

**Bot：**  
請用「文字」描述您回傳之訊息。

**User：**  
\[text text text\]

**Bot：**  
小幫鼠收到進階描述，感謝回報！  
會由 DTL 團隊進行後續分析。

**Bot：**  
可以繼續回報新的可疑資訊囉！

【if user 選擇「否」】

**Bot：**  
收到，可以繼續回報新的可疑資訊囉！

# Scenario 4 \- report pure link

【當系統收到使用者回傳連結訊息】

**User：**  
\[url\]

**Bot：**  
小幫鼠收到「連結」，來自「xxx」平台，感謝回報！  
會由 DTL 團隊進行後續分析。

**Bot：**  
您是否願意針對您提供的訊息做進階描述，以便分析團隊做後續判斷。  
請選擇「是」或「否」。

**Bot：**  
【是 or 否 選項】  
示意圖：  
![][image1]

【if user 選擇「是」】

**Bot：**  
請用「文字」描述您回傳之訊息。

**User：**  
\[text text text\]

**Bot：**  
小幫鼠收到進階描述，感謝回報！  
會由 DTL 團隊進行後續分析。

**Bot：**  
可以繼續回報新的可疑資訊囉！

【if user 選擇「否」】

**Bot：**  
收到，可以繼續回報新的可疑資訊囉！

# Scenario 5 \- report pure picture

【當系統收到使用者回傳圖片訊息】

**User：**  
\[picture\]

**Bot：**  
小幫鼠收到「圖片」，感謝回報！  
會由 DTL 團隊進行後續分析。

**Bot：**  
您是否願意針對您提供的圖片內容做進階描述，以便分析團隊做後續判斷。  
請選擇「是」或「否」。

**Bot：**  
【是 or 否 選項】  
示意圖：  
![][image1]

【if user 選擇「是」】

**Bot：**  
請用「文字」描述您回傳之訊息。

**User：**  
\[text text text\]

**Bot：**  
小幫鼠收到進階描述，感謝回報！  
會由 DTL 團隊進行後續分析。

**Bot：**  
可以繼續回報新的可疑資訊囉！

【if user 選擇「否」】

**Bot：**  
收到，可以繼續回報新的可疑資訊囉！

# Scenario 6 \- report pure video

【當系統收到使用者回傳影片訊息】

**User：**  
\[video\]

**Bot：**  
小幫鼠收到「影片」，感謝回報！  
會由 DTL 團隊進行後續分析。

**Bot：**  
您是否願意針對您提供的影片內容做進階描述，以便分析團隊做後續判斷。  
請選擇「是」或「否」。

**Bot：**  
【是 or 否 選項】  
示意圖：  
![][image1]

【if user 選擇「是」】

**Bot：**  
請用「文字」描述您回傳之訊息。

**User：**  
\[text text text\]

**Bot：**  
小幫鼠收到進階描述，感謝回報！  
會由 DTL 團隊進行後續分析。

**Bot：**  
可以繼續回報新的可疑資訊囉！

【if user 選擇「否」】

**Bot：**  
收到，可以繼續回報新的可疑資訊囉！

# Scenario 7 \- this type of content is not accepted

【當系統收到使用者回傳不支援的訊息類型】

**User：**  
\[sticker\] or \[file\]

**Bot：**  
很抱歉，小幫鼠不收集您回傳的訊息類型！  
請傳以下類型的訊息，如：文字、連結、圖片、影片。  
   
**Bot：**  
可以繼續回報新的可疑資訊囉！

# Scenario 8 \- Our Facebook 

【當 DTL 社群發文】

**Bot**：  
【傳臉書貼文給所有使用者】

🔔 【DTL 最新情資與觀察報告】

各位 DTL 的夥伴，我們剛剛發布了最新的社群貼文！

🔗 完整內容請看 Facebook 貼文：  
👉 \[點此閱讀\]  
( https://www.facebook.com/your\_post\_link )

# 

# Sheet adjustment

1. 「A 回報者 line 亂數 ID」保留  
2. 「B 狀態」需刪除  
3. 「C 類型」需保留  
4. 「D 平台」需保留  
5. 「E 帳號」需保留  
6. 「F 內容/URL」需保留  
7. 「G 回報人數」需刪除  
8. 「H 調查員」需刪除  
9. 「I AI摘要」需刪除  
10. 「J 建立時間」需保留  
    1. 需要把日期 跟 時間拆開  
11. （John）新增欄位「Archive」，上傳連結到 sheet 的同時 archive 訊息到新的 archive 欄位  
12. 把 Cofact 的 AI 功能刪除  
13. 把 Cofact 的圖片刪除

NOTE

- 我們的 Facebook 有發文，同步到 Line Bot 上讓 User 看到。  
  - 增加 Line Bot 跟 User 互動的可行性  
- 直接在 Sheet 上做 archive，新增欄位是 archive 的 line  
- 把 Cofact AI 功能刪除

[image1]: <data:image/png;base64,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>