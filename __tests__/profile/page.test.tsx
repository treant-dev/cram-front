import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import ProfilePage from '@/profile/page';
import { getUserInfo } from '@/lib/client';
import { User } from '@/lib/types';

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ priority, ...props }: any) => <img {...props} />,
}));

jest.mock('@/lib/client');

const mockUser: User = {
    avatar_url: 'https://example.com/avatar.png',
    name: 'John Doe',
    login: 'johndoe',
    email: 'john@example.com',
};

describe('ProfilePage', () => {
    it('renders loading state', () => {
        (getUserInfo as jest.Mock).mockReturnValue(new Promise(() => { }));
        render(<ProfilePage />);
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders user info after data loads', async () => {
        // TODO: mock on a lower level
        (getUserInfo as jest.Mock).mockResolvedValue({ data: mockUser });
        render(<ProfilePage />);

        await waitFor(() => {
            expect(screen.getByText(mockUser.name)).toBeInTheDocument();
            expect(screen.getByText(mockUser.login)).toBeInTheDocument();
            expect(screen.getByText(mockUser.email)).toBeInTheDocument();
            expect(screen.getByAltText('avatar')).toHaveAttribute('src', mockUser.avatar_url);
        });

    });

    it('matches snapshot', async () => {
        (getUserInfo as jest.Mock).mockResolvedValue({ data: mockUser });
        const { asFragment } = render(<ProfilePage />);

        await waitFor(() => {
            expect(screen.getByText(mockUser.name)).toBeInTheDocument();
        });

        expect(asFragment()).toMatchSnapshot();
    });
});
