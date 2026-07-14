import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { JwtModule } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test' })],
      providers: [AuthService, UsersService],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    await usersService.ready;
  });

  beforeEach(async () => {
    const all = await usersService.findAll();
    for (const u of all) {
      await usersService.remove(u.id);
    }
  });

  it('register creates user and returns token', async () => {
    const result = await service.register({
      email: 'test@demo.com',
      password: 'password123',
      name: 'Test User',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.user.email).toBe('test@demo.com');
    expect(result.user.role).toBe('employee');
  });

  it('login returns token for valid credentials', async () => {
    await service.register({
      email: 'login@demo.com',
      password: 'password123',
      name: 'Login User',
    });

    const result = await service.login({
      email: 'login@demo.com',
      password: 'password123',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.user.email).toBe('login@demo.com');
  });

  it('login throws for invalid credentials', async () => {
    await expect(
      service.login({ email: 'wrong@demo.com', password: 'nope' }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('register throws for duplicate email', async () => {
    await service.register({
      email: 'dup@demo.com',
      password: 'password123',
      name: 'Dup User',
    });

    await expect(
      service.register({
        email: 'dup@demo.com',
        password: 'password123',
        name: 'Dup User 2',
      }),
    ).rejects.toThrow();
  });
});
