import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../src/users/users.service';
import { Role } from '../src/users/entities/role.enum';

describe('UsersService', () => {
  let service: UsersService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  beforeEach(async () => {
    const all = await service.findAll();
    for (const u of all) {
      await service.remove(u.id);
    }
  });

  it('findByEmail returns undefined for missing user', async () => {
    const user = await service.findByEmail('missing@demo.com');
    expect(user).toBeUndefined();
  });

  it('promote changes user role', async () => {
    const created = await service.create(
      'promote@demo.com',
      'password123',
      'Promote User',
      Role.VIEWER,
    );

    expect(created.role).toBe(Role.VIEWER);

    const updated = await service.promote(created.id, Role.ADMIN);
    expect(updated.role).toBe(Role.ADMIN);
  });
});
