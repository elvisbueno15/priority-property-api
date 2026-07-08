export class User {
  constructor(
    public id: string,
    public email: string,
    public passwordHash: string,
    public name: string,
    public role: string,
    public createdAt: string,
    public updatedAt: string,
  ) {}
}
