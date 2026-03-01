declare module 'resend' {
  export type EmailSendOptions = {
    from: string;
    to: string;
    subject: string;
    html: string;
  };

  export class Resend {
    constructor(apiKey: string);
    emails: {
      send(options: EmailSendOptions): Promise<unknown>;
    };
  }
}
