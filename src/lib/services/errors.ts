// kesalahan wajar akibat aturan bisnis; pesannya aman ditampilkan ke pengguna
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}