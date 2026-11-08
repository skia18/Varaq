import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import type { ComponentType } from 'react';

function lazyComponent(importer: () => Promise<unknown>, exportName: string): RouteObject['lazy'] {
  return async () => {
    const module = (await importer()) as Record<string, unknown>;
    return { Component: module[exportName] as ComponentType };
  };
}

export const router = createBrowserRouter([
  {
    lazy: lazyComponent(() => import('../layouts/AuthLayout'), 'AuthLayout'),
    children: [
      {
        path: '/login',
        lazy: lazyComponent(() => import('@/components/login/login-form'), 'LoginForm'),
      },
      {
        path: '/signup',
        lazy: lazyComponent(() => import('@/components/login/sign-up-form'), 'SignUpForm'),
      },
      {
        path: '/forgot-password',
        lazy: lazyComponent(
          () => import('@/components/login/forgot-password-form'),
          'ForgotPasswordForm',
        ),
      },
      {
        path: '/update-password',
        lazy: lazyComponent(
          () => import('@/components/login/update-password-form'),
          'UpdatePasswordForm',
        ),
      },
    ],
  },
  {
    lazy: lazyComponent(() => import('../layouts/PublicLayout'), 'PublicLayout'),
    children: [
      { path: '/', lazy: lazyComponent(() => import('../pages/home/HomePage'), 'HomePage') },
      {
        path: '/discover',
        lazy: lazyComponent(() => import('../pages/discover/DiscoverPage'), 'DiscoverPage'),
      },
      {
        path: '/collections/:collectionId',
        lazy: lazyComponent(
          () => import('../pages/collections/CollectionDetailPage'),
          'CollectionDetailPage',
        ),
      },

      // Public writer wall.
      {
        path: '/wall/:handle',
        lazy: lazyComponent(() => import('../pages/profile/PublicWallPage'), 'PublicWallPage'),
      },
      {
        path: '/piece/:pieceId',
        lazy: lazyComponent(
          () => import('@/features/vault/PublishedPiecePage'),
          'PublishedPiecePage',
        ),
      },
      { path: '/trails', element: <Navigate to="/?view=trails" replace /> },
      {
        path: '/trail/:pieceId',
        lazy: lazyComponent(() => import('../pages/trails/TrailPage'), 'TrailPage'),
      },

      {
        lazy: lazyComponent(() => import('@/auth/ProtectedRoute'), 'ProtectedRoute'),
        children: [
          {
            path: '/collections',
            lazy: lazyComponent(
              () => import('../pages/collections/CollectionsPage'),
              'CollectionsPage',
            ),
          },
          { path: '/saved', element: <Navigate to="/collections" replace /> },

          // Published-content management.
          {
            path: '/published',
            lazy: lazyComponent(() => import('../pages/profile/PublicWallPage'), 'MyWallRedirect'),
          },
          {
            path: '/wall/manage/edit',
            lazy: lazyComponent(
              () => import('../pages/write/PublishedWritingRoomPage'),
              'PublishedWritingRoomPage',
            ),
          },
          {
            path: '/published/edit',
            lazy: lazyComponent(
              () => import('../pages/write/PublishedWritingRoomPage'),
              'PublishedWritingRoomPage',
            ),
          },
          {
            lazy: lazyComponent(() => import('@/features/vault/VaultProvider'), 'VaultRoute'),
            children: [
              {
                path: '/vault',
                lazy: lazyComponent(() => import('@/features/vault/VaultPage'), 'VaultPage'),
              },
              {
                path: '/vault/draft/:pieceId',
                lazy: lazyComponent(
                  () => import('@/features/vault/VaultDraftPage'),
                  'VaultDraftPage',
                ),
              },
              {
                path: '/vault/return/:pieceId',
                lazy: lazyComponent(
                  () => import('@/features/vault/ReturnToVaultPage'),
                  'ReturnToVaultPage',
                ),
              },

              // Writing room.
              {
                path: '/write',
                lazy: lazyComponent(
                  () => import('../pages/write/WritingRoomPage'),
                  'WritingRoomPage',
                ),
              },
            ],
          },
        ],
      },

      {
        path: '*',
        lazy: lazyComponent(() => import('../pages/NotFoundPage'), 'NotFoundPage'),
      },
    ],
  },
]);
