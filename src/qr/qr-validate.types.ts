export type QrValidationResult = 'VALID' | 'INVALID' | 'ALREADY_USED';

export type QrTicketContext = {
  publicCode: string;
  eventTitle: string;
  ticketTypeName: string;
  tier: string;
  holderEmail: string;
};

export type QrValidateResponse = {
  result: QrValidationResult;
  ticket?: QrTicketContext;
};
