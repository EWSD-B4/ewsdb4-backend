import { requireFacultyIfRoleNeedsIt } from '../facultyScope';
import { db as prisma } from '../../shared/database';

jest.mock('../../shared/database', () => ({
  __esModule: true,
  db: {
    user: {
      findUnique: jest.fn(),
    },
  },
  database: {
    connect: jest.fn(),
    disconnect: jest.fn(),
  },
}));

const mockReq = (user: any) => ({ user, requestId: 'test' }) as any;
const mockRes = () => ({}) as any;
const mockNext = jest.fn();

describe('requireFacultyIfRoleNeedsIt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks when coordinator has no faculty', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, facultyId: null });
    await requireFacultyIfRoleNeedsIt(
      mockReq({ id: '1', role: 'coordinator' }),
      mockRes(),
      mockNext
    );
    const err = (mockNext as jest.Mock).mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.code).toBe('FORBIDDEN');
  });

  it('passes when student has faculty', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, facultyId: 2 });
    await requireFacultyIfRoleNeedsIt(mockReq({ id: '1', role: 'student' }), mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });
});
