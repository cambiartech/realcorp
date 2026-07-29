/** Shared centered-dialog panel shells — use as ModalOverlay `panelClassName`. */
const BASE =
  "max-h-[min(90vh,720px)] w-full shrink-0 overflow-y-auto rounded-xl border border-foreground/10 bg-background shadow-2xl";

export const MODAL_PANEL_XS = `${BASE} max-w-sm p-5 sm:p-6`;
export const MODAL_PANEL_SM = `${BASE} max-w-md p-5 sm:p-6`;
export const MODAL_PANEL_MD = `${BASE} max-w-lg p-5 sm:p-6`;
export const MODAL_PANEL_LG = `${BASE} max-w-xl p-5 sm:p-6`;
export const MODAL_PANEL_XL = `${BASE} max-w-2xl p-6 sm:p-7`;
/** Wide forms on desktop — task create/edit, multi-column fields */
export const MODAL_PANEL_FORM = `${BASE} max-w-3xl p-6 sm:p-8`;
export const MODAL_PANEL_2XL =
  "flex max-h-[min(90vh,720px)] w-full max-w-4xl shrink-0 flex-col overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-2xl";
