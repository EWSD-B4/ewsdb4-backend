declare module 'archiver' {
  const archiver: any;
  export default archiver;
}

declare module 'string-similarity' {
  const stringSimilarity: {
    compareTwoStrings: (first: string, second: string) => number;
  };
  export default stringSimilarity;
}

declare module 'mongoose' {
  export type Document = any;
  export const Schema: any;
  const mongoose: any;
  export default mongoose;
}
