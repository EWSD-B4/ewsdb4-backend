const stringSimilarity = {
  compareTwoStrings: jest.fn().mockReturnValue(0),
  findBestMatch: jest.fn().mockImplementation((mainString: string, targetStrings: string[]) => ({
    ratings: targetStrings.map((target) => ({ target, rating: 0 })),
    bestMatch: { target: targetStrings[0] ?? mainString, rating: 0 },
    bestMatchIndex: targetStrings.length > 0 ? 0 : -1,
  })),
};

export default stringSimilarity;
