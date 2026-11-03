// @flow

/**
 * The debloated editor deliberately excludes GDevelop's Ask AI assistant.
 * This is not a runtime preference: restoring the assistant also requires
 * restoring the UI renderer and provider removed from this fork.
 */
export const IS_AI_ASSISTANT_DISABLED = true;
