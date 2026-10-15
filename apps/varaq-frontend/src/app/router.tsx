import { createBrowserRouter } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout';
import { DiscoverPage } from '../pages/discover/DiscoverPage';
import { HomePage } from '../pages/home/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/discover',
        element: <DiscoverPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);