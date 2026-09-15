import { create } from "zustand";

interface PreviewTabState {
  selectedPath: string | null;
  selectedConversationId: string | null;
  setPreviewPath: (path: string | null, conversationId?: string | null) => void;
}

/**
 * Selection for the Preview drawer tab. Kept separate from `files-tab-store`
 * so opening a preview does not clobber the Files tab's open-file strip.
 */
export const usePreviewTabStore = create<PreviewTabState>((set) => ({
  selectedPath: null,
  selectedConversationId: null,
  setPreviewPath: (selectedPath, conversationId = null) =>
    set((state) => {
      if (
        conversationId != null &&
        state.selectedConversationId != null &&
        conversationId !== state.selectedConversationId
      ) {
        return {
          selectedPath,
          selectedConversationId: conversationId,
        };
      }
      return {
        selectedPath,
        selectedConversationId: conversationId ?? state.selectedConversationId,
      };
    }),
}));
