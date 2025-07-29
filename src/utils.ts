
/**
 * Utility function to delay execution for a specified amount of time
 * @param ms Time to delay in milliseconds
 * @returns Promise that resolves after the specified delay
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

