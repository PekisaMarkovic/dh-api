export enum PurchaseImportStatusEnums {
  /** the document was sent to the AI */
  PARSING = 'parsing',
  /** the AI read the lines, the user did not add them to the stock yet */
  PARSED = 'parsed',
  /** the AI failed, see errorMessage */
  FAILED = 'failed',
  /** the checked lines were added to the stock */
  APPLIED = 'applied',
}
