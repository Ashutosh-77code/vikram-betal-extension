# Vikram & Betal

Highlight any text on a web page and get an instant answer in a small popup. **Vikram** is your assistant: he explains, translates, summarizes and answers. **Betal** is the ghost on his back who roasts him after every answer. Vikram never replies to him.

## What you can do

- **Highlight text**, then pick **Ask Vikram**, **Explain**, **Translate** or **Summarize**. The answer appears right under your selection.
- **Chat** with Vikram in the side panel.
- **Summarize page** to get the main points of the page you're on.
- **Scan QR on screen** to read a QR code you can see on the page, check whether the link looks safe, and open it only if you choose.

## Set it up (about 3 minutes)

**1. Add it to Chrome**
1. Unzip the download and keep the folder somewhere permanent (Documents is fine). Chrome reads from it, so don't delete it.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the unzipped folder.
5. Click the puzzle-piece icon in the toolbar and pin **Vikram & Betal**.

**2. Get a free key**
1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with a Google account.
2. Click **Get API key** and copy it.

**3. Add your key**
1. Click the Vikram & Betal icon (or press **Alt+V**) to open the side panel.
2. Click **Settings**, choose **Google Gemini (free tier)**, paste your key, and click **Save**.

That's it. Open any website, highlight a sentence, and try it.

## Tips

- After installing or updating, **refresh pages that were already open**. Otherwise the highlight bar won't appear on them.
- Press **Esc** or click anywhere else to close the popup.
- The popup works on normal websites. Chrome blocks extensions on `chrome://` pages and the Chrome Web Store.
- Don't want the roasts? Turn off **Let Betal heckle** in Settings.
- Hit Alt+V to open the chat panel any time. Use **Clear** to start a fresh conversation.

## Troubleshooting

| What you see | What to do |
|---|---|
| Highlight bar doesn't appear | Refresh the page. |
| "No API key yet" | Open Settings in the side panel and save your key. |
| "Model not found" or a 404 | Google renames models over time. In Settings, type a current model name from aistudio.google.com into the model fields. Check there is no typo. |
| "429" or a rate-limit message | You've used up the free allowance for now. Wait a minute, or try again tomorrow. |
| Vikram replies with nothing | Try a different model in Settings. |
| Scan QR says no code found | Make sure the whole code is visible on screen. See the note below. |

**QR scanning on Windows or Linux:** Chrome there doesn't include a QR reader. Download the free file `jsQR.js` (from the `jsqr` package on npm, in its `dist` folder), put it in the extension's `lib` folder replacing the file with the same name, then click the reload icon on the extension in `chrome://extensions`.

## Privacy

- Your key is saved only in your browser.
- Whatever text you highlight, or the page you ask Vikram to summarize, is sent to the provider you chose (Google by default) to get an answer. Don't use it on private or sensitive material.
- On Google's free tier, your requests may be used to improve Google's products. A paid key doesn't do that.
- There are no other servers involved. This extension doesn't collect anything itself.

## Other providers

In Settings you can also pick **xAI Grok** or **Anthropic Claude**. These generally need a paid key, so check the provider's pricing first.
