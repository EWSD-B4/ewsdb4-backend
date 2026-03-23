export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        facultyId?: number | null;
      };
      requestId?: string;
    }
  }
}
