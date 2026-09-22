# Editor guide

Follow [installation and live setup](../README.md#live-rewriting), run `npm run dev`, and open localhost:3000.

Paste a complete source or load the 1,115-word customer-policy example with six selected conditions. Select text directly in the source box, then click a protection button in **Protected details**. You can also hold **Alt** (Option on Mac) and press its letter. No Shift is needed; typing a letter alone still types normally. The selected text is saved and marked automatically. Repeat for other passages, then choose **Rewrite**.

| Control | Behavior |
|---|---|
| Keep wording / Alt+S | Check exact selected characters, including punctuation and whitespace. |
| Keep meaning / Alt+M | Check the same claim, numbers, certainty, scope and conditions. |
| Must cover / Alt+C | Extract ideas into a checklist you review and prune before rewriting. |
| Not this / Alt+X | Omit a passage from the source sent to the writer. This is not a semantic absence check. |

Protections can overlap: keep one sentence word for word while keeping the meaning of the paragraph around it. Each protection receives its own check. You can apply another protection to the same selection without selecting it again. Exclusions cannot overlap protected passages.

Use **Undo / Redo** below Source to reverse protection changes, removed ideas, source replacements or Clear. **Ctrl+Z** undoes; **Ctrl+Shift+Z** or **Ctrl+Y** redoes (⌘ on Mac). Inside a text field these shortcuts undo typing normally.

Protections constrain the whole rewrite, rather than turning it into a list of highlights. Select a checked item to trace its source and reply evidence. Editing a reply invalidates its previous check; use **Check & repair** again.

The full editing instruction and writer/model selector sit below the documents. Presets supply instructions you can edit. The model menu supports API providers, Codex/Claude Code CLIs and custom model IDs. [Connections](MODELS.md).

## File import

The editor accepts `.txt`, `.md`, and PDFs with selectable text. PDF extraction runs in the local app; scanned PDFs need OCR first. Source input is limited to 50,000 words and 500,000 characters. PDFs are limited to 10 MB and 200 pages.

The extension currently provides the three verification modes. PDF import and **Not this** are editor features.
