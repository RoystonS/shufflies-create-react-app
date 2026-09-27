/** Raised for problems the user can fix, such as a bad name or a non-empty directory. */
export class ScaffoldError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ScaffoldError";
  }
}
