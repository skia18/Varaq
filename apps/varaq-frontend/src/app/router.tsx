
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { PublicLayout } from '../layouts/PublicLayout';
import { DiscoverPage } from '../pages/discover/DiscoverPage';
import { HomePage } from '../pages/home/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { CollectionsPage } from '../pages/collections/CollectionsPage';
import { SavedPagesPage } from '../pages/saved/SavedPagesPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { PublicWallPage } from '../pages/profile/PublicWallPage';
import { WritingRoomPage } from '../pages/write/WritingRoomPage';
import { LoginForm } from '@/components/login/login-form';
import { SignUpForm } from '@/components/login/sign-up-form';
import { ForgotPasswordForm } from '@/components/login/forgot-password-form';
import { UpdatePasswordForm } from '@/components/login/update-password-form';
import { ProtectedRoute } from '@/auth/ProtectedRoute';

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/login', element: <LoginForm /> },
      { path: '/signup', element: <SignUpForm /> },
      { path: '/forgot-password', element: <ForgotPasswordForm /> },
      { path: '/update-password', element: <UpdatePasswordForm /> },
      { path: '/discover', element: <DiscoverPage /> },
      { path: '/collections', element: <CollectionsPage /> },

      // Public writer wall.
      { path: '/wall/:handle', element: <PublicWallPage /> },

      {
        element: <ProtectedRoute />,
        children: [
          { path: '/saved', element: <SavedPagesPage /> },

          // Private workspace: drafts, private pieces and unlisted pieces.
          { path: '/vault', element: <ProfilePage /> },

          // Writing room.
          { path: '/write', element: <WritingRoomPage /> },

          // Legacy shortcut; redirects to the signed-in writer's public wall.
          // MyWallRedirect must be implemented separately.
          // { path: '/wall/you', element: <MyWallRedirect /> },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
